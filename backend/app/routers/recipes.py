import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.rate_limit import limiter
from app.core.units import to_base_unit
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Recipe, RecipeIngredient, User
from app.data.starter_catalog import STARTER_CATALOG, get_catalog_recipe
from app.schemas import (
    CatalogRecipe,
    RecipeAiRequest,
    RecipeAiResponse,
    RecipeCreate,
    RecipeImportRequest,
    RecipeImportResponse,
    RecipeResponse,
    RecipeUpdate,
    TranscriptIngredientsRequest,
    TranscriptIngredientsResponse,
)
from app.services.ai_service import generate_recipe, parse_ingredients_from_transcript
from app.services.recipe_import_service import RecipeImportError, import_recipe_from_url

router = APIRouter()


async def _load_recipe(db: AsyncSession, recipe_id: uuid.UUID) -> Recipe:
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(selectinload(Recipe.ingredients))
    )
    return result.scalar_one()


@router.get("/", response_model=list[RecipeResponse])
async def list_recipes(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all recipes for the current user."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
        .order_by(Recipe.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(
    data: RecipeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new recipe."""
    recipe = Recipe(
        user_id=user.id,
        nome=data.nome,
        rendimento_base=data.rendimento_base,
        tipo=data.tipo,
    )
    db.add(recipe)
    await db.flush()

    for ing in data.ingredients:
        base_qtd, base_unit = to_base_unit(ing.quantidade, ing.unidade)
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingrediente=ing.ingrediente,
                quantidade=ing.quantidade,
                unidade=ing.unidade,
                preco_unitario=ing.preco_unitario,
                unidade_base=base_unit,
                unidade_base_qtd=base_qtd,
            )
        )

    await db.commit()
    return await _load_recipe(db, recipe.id)


@router.post("/import", response_model=RecipeImportResponse)
@limiter.limit("10/minute")
async def import_recipe(
    request: Request,
    data: RecipeImportRequest = Body(...),
    user: User = Depends(get_current_user),
):
    """Parse a public recipe URL into structured data (user reviews before saving)."""
    try:
        result = await import_recipe_from_url(data.url)
    except RecipeImportError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)
        ) from None
    return result


@router.post("/generate-ai", response_model=RecipeAiResponse)
@limiter.limit("5/minute")
async def generate_recipe_with_ai(
    request: Request,
    data: RecipeAiRequest = Body(...),
    user: User = Depends(get_current_user),
):
    """Gera uma receita com IA para revisão antes de salvar."""
    return await generate_recipe(data.prato, data.porcoes, data.observacoes)


@router.post("/parse-transcript", response_model=TranscriptIngredientsResponse)
@limiter.limit("10/minute")
async def parse_transcript_ingredients(
    request: Request,
    data: TranscriptIngredientsRequest = Body(...),
    user: User = Depends(get_current_user),
):
    """Extrai ingredientes da fala (LLM se configurada; senão parser local)."""
    result = await parse_ingredients_from_transcript(data.transcript)
    if not result["ingredients"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Não consegui identificar ingredientes na fala. "
                "Ex.: 1 kg de farinha a 5 reais, 2 ovos a 1 real cada."
            ),
        )
    return result


@router.get("/catalog", response_model=list[CatalogRecipe])
async def list_catalog(user: User = Depends(get_current_user)):
    """List starter recipes available to adopt into the user's library."""
    return STARTER_CATALOG


@router.post(
    "/catalog/{slug}/adopt",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def adopt_catalog_recipe(
    slug: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Copy a catalog recipe into the current user's recipes."""
    item = get_catalog_recipe(slug)
    if item is None:
        raise HTTPException(status_code=404, detail="Catalog recipe not found")

    recipe = Recipe(
        user_id=user.id,
        nome=item["nome"],
        rendimento_base=item["rendimento_base"],
        tipo=item["tipo"],
    )
    db.add(recipe)
    await db.flush()

    for ing in item["ingredients"]:
        base_qtd, base_unit = to_base_unit(ing["quantidade"], ing["unidade"])
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingrediente=ing["ingrediente"],
                quantidade=ing["quantidade"],
                unidade=ing["unidade"],
                preco_unitario=ing.get("preco_unitario", 0),
                unidade_base=base_unit,
                unidade_base_qtd=base_qtd,
            )
        )

    await db.commit()
    return await _load_recipe(db, recipe.id)


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a recipe by ID."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: uuid.UUID,
    data: RecipeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a recipe."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if data.nome is not None:
        recipe.nome = data.nome
    if data.rendimento_base is not None:
        recipe.rendimento_base = data.rendimento_base
    if data.tipo is not None:
        recipe.tipo = data.tipo
    if data.ingredients is not None:
        # Replace all ingredients
        recipe.ingredients.clear()
        for ing in data.ingredients:
            base_qtd, base_unit = to_base_unit(ing.quantidade, ing.unidade)
            recipe.ingredients.append(
                RecipeIngredient(
                    ingrediente=ing.ingrediente,
                    quantidade=ing.quantidade,
                    unidade=ing.unidade,
                    preco_unitario=ing.preco_unitario,
                    unidade_base=base_unit,
                    unidade_base_qtd=base_qtd,
                )
            )

    await db.commit()
    return await _load_recipe(db, recipe.id)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a recipe."""
    result = await db.execute(
        select(Recipe).where(Recipe.id == recipe_id, Recipe.user_id == user.id)
    )
    recipe = result.scalar_one_or_none()
    if recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    await db.delete(recipe)
    await db.commit()


@router.post(
    "/{recipe_id}/duplicate",
    response_model=RecipeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def duplicate_recipe(
    recipe_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Duplicate a recipe."""
    result = await db.execute(
        select(Recipe)
        .where(Recipe.id == recipe_id, Recipe.user_id == user.id)
        .options(selectinload(Recipe.ingredients))
    )
    original = result.scalar_one_or_none()
    if original is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    recipe = Recipe(
        user_id=user.id,
        nome=f"{original.nome} (cópia)",
        rendimento_base=original.rendimento_base,
        tipo=original.tipo,
    )
    db.add(recipe)
    await db.flush()

    for ing in original.ingredients:
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingrediente=ing.ingrediente,
                quantidade=ing.quantidade,
                unidade=ing.unidade,
                preco_unitario=ing.preco_unitario,
                unidade_base=ing.unidade_base,
                unidade_base_qtd=ing.unidade_base_qtd,
            )
        )

    await db.commit()
    return await _load_recipe(db, recipe.id)
