# SSM Parameter Store - Secrets
resource "aws_ssm_parameter" "db_password" {
  name        = "/${var.app_name}/db/password"
  description = "PostgreSQL password"
  type        = "SecureString"
  value       = var.db_password
}

resource "aws_ssm_parameter" "jwt_private_key" {
  name        = "/${var.app_name}/jwt/private_key"
  description = "JWT RSA private key"
  type        = "SecureString"
  value       = var.jwt_private_key
}

resource "aws_ssm_parameter" "jwt_public_key" {
  name        = "/${var.app_name}/jwt/public_key"
  description = "JWT RSA public key"
  type        = "SecureString"
  value       = var.jwt_public_key
}

resource "aws_ssm_parameter" "mercado_pago_access_token" {
  name        = "/${var.app_name}/mercado_pago/access_token"
  description = "Mercado Pago access token"
  type        = "SecureString"
  value       = var.mercado_pago_access_token
}

resource "aws_ssm_parameter" "resend_api_key" {
  name        = "/${var.app_name}/resend/api_key"
  description = "Resend API key"
  type        = "SecureString"
  value       = var.resend_api_key
}

resource "aws_ssm_parameter" "app_env" {
  name        = "/${var.app_name}/app/env"
  description = "Application environment"
  type        = "String"
  value       = var.environment
}
