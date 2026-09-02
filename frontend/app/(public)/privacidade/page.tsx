import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Política de Privacidade</h1>
        <p className="text-text-secondary mt-2">
          Última atualização: 1 de setembro de 2026
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">1. Quem somos</h2>
        <p className="text-text-secondary">
          Desperdício Zero é um serviço de gestão de desperdício alimentar para pequenos negócios.
          Operamos em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">2. Dados que coletamos</h2>
        <ul className="list-disc list-inside text-text-secondary space-y-2">
          <li><strong>Dados de cadastro:</strong> email e senha (hash argon2)</li>
          <li><strong>Dados de uso:</strong> receitas, produções, listas de compras, registros de desperdício</li>
          <li><strong>Dados de pagamento:</strong> processados pelo Mercado Pago (não armazenamos dados de cartão)</li>
          <li><strong>Dados de navegação:</strong> cookies essenciais para funcionamento do PWA</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">3. Como usamos seus dados</h2>
        <ul className="list-disc list-inside text-text-secondary space-y-2">
          <li>Gerenciar sua conta e fornecer o serviço contratado</li>
          <li>Calcular métricas de desperdício e economia</li>
          <li>Enviar lembretes por email (com opção de cancelamento)</li>
          <li>Gerar listas de compras automáticas</li>
          <li>Melhorar o produto (dados anonimizados e agregados)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">4. Compartilhamento de dados</h2>
        <p className="text-text-secondary">
          <strong>Não vendemos seus dados.</strong> Compartilhamos apenas com:
        </p>
        <ul className="list-disc list-inside text-text-secondary space-y-2">
          <li><strong>Mercado Pago:</strong> processamento de pagamentos</li>
          <li><strong>Resend:</strong> envio de emails transacionais</li>
          <li><strong>AWS:</strong> hospedagem e armazenamento (dados criptografados)</li>
        </ul>
        <p className="text-text-secondary">
          Dados para benchmark (comparação entre negócios) são sempre anonimizados e agregados.
          Nenhum dado individual é exposto a outros usuários.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">5. Seus direitos (LGPD)</h2>
        <ul className="list-disc list-inside text-text-secondary space-y-2">
          <li><strong>Acesso:</strong> solicite uma cópia de todos os seus dados</li>
          <li><strong>Correção:</strong> corrija dados incompletos ou desatualizados</li>
          <li><strong>Exclusão:</strong> solicite a deletação da sua conta e todos os dados associados</li>
          <li><strong>Portabilidade:</strong> exporte seus dados em formato estruturado</li>
          <li><strong>Revogação:</strong> cancele o consentimento a qualquer momento</li>
        </ul>
        <p className="text-text-secondary">
          Para exercer seus direitos, acesse{" "}
          <Link href="/settings" className="text-primary-600 hover:underline">
            Configurações → Dados e Privacidade
          </Link>{" "}
          ou entre em contato com privacidade@desperdiciozero.com.br.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">6. Segurança</h2>
        <p className="text-text-secondary">
          Utilizamos HTTPS (TLS 1.3), senhas com hash argon2id, tokens JWT RS256 com rotação,
          e dados criptografados em repouso (EBS) e em trânsito. Backups diários são armazenados
          em S3 com lifecycle de 30 dias.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">7. Retenção de dados</h2>
        <p className="text-text-secondary">
          Seus dados são mantidos enquanto sua conta estiver ativa. Após a exclusão da conta,
          todos os dados são removidos permanentemente em até 30 dias. Backups são retidos por
          30 dias conforme política de lifecycle do S3.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary">8. Contato</h2>
        <p className="text-text-secondary">
          Encarregado de dados (DPO): privacidade@desperdiciozero.com.br
          <br />
          Endereço: [a definir]
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
