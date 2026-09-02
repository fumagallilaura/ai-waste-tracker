import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Termos de Uso</h1>
        <p className="text-text-secondary mt-2">
          Última atualização: 1 de setembro de 2026
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">1. Aceitação dos termos</h2>
        <p className="text-text-secondary">
          Ao acessar e usar o Desperdício Zero, você concorda com estes Termos de Uso.
          Se não concordar, não utilize o serviço.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">2. Descrição do serviço</h2>
        <p className="text-text-secondary">
          O Desperdício Zero é uma plataforma de gestão de desperdício alimentar que permite:
        </p>
        <ul className="list-disc list-inside text-text-secondary space-y-2">
          <li>Cadastrar receitas com ingredientes e custos</li>
          <li>Planejar produções (eventos ou turnos diários)</li>
          <li>Gerar listas de compras automáticas</li>
          <li>Registrar e acompanhar desperdício</li>
          <li>Visualizar métricas de economia</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">3. Planos e pagamento</h2>
        <p className="text-text-secondary">
          <strong>Plano Grátis:</strong> 1 produção por mês, receitas ilimitadas.
          <br />
          <strong>Plano Pro:</strong> R$19,90/mês ou R$149/ano — produções ilimitadas, insights e gamificação.
        </p>
        <p className="text-text-secondary">
          O pagamento é processado pelo Mercado Pago. Não armazenamos dados de cartão de crédito.
          Você pode cancelar a qualquer momento sem multa.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">4. Responsabilidades</h2>
        <p className="text-text-secondary">
          Você é responsável por:
        </p>
        <ul className="list-disc list-inside text-text-secondary space-y-2">
          <li>Manter a segurança da sua conta</li>
          <li>Fornecer informações precisas</li>
          <li>Usar o serviço de forma legal e ética</li>
        </ul>
        <p className="text-text-secondary">
          O Desperdício Zero fornece estimativas baseadas em dados de mercado.
          Os valores de economia e desperdício são aproximados e não constituem
          aconselhamento financeiro ou contábil.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">5. Propriedade intelectual</h2>
        <p className="text-text-secondary">
          O código, design e marca do Desperdício Zero são protegidos por direitos autorais.
          Seus dados (receitas, produções) são seus — você pode exportá-los a qualquer momento.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">6. Limitação de responsabilidade</h2>
        <p className="text-text-secondary">
          O serviço é fornecido "como está". Não garantimos que será ininterrupto ou livre de erros.
          Não nos responsabilizamos por perdas indiretas, lucros cessantes ou danos consequenciais.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">7. Alterações nos termos</h2>
        <p className="text-text-secondary">
          Podemos atualizar estes termos. Notificaremos mudanças significativas por email ou
          notificação no app. O uso continuado após alterações constitui aceitação.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">8. Contato</h2>
        <p className="text-text-secondary">
          Dúvidas? Entre em contato: suporte@desperdiciozero.com.br
        </p>
      </section>

      <div className="pt-8 border-t border-border-default">
        <Link href="/" className="text-primary-600 hover:underline">
          ← Voltar para a calculadora
        </Link>
      </div>
    </div>
  );
}
