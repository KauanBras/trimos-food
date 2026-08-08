import { LegalPage } from "@/components/marketing/legal-page";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Informação legal"
      title="Termos de utilização"
      introduction="Estes termos regulam o acesso à plataforma Trimos Food por restaurantes, respetivas equipas e utilizadores autorizados."
      sections={[
        {
          title: "1. Serviço",
          paragraphs: [
            "A Trimos Food disponibiliza software para gestão de menus, pedidos, pagamentos, reservas, clientes e entregas. Cada restaurante é responsável pela sua operação, pelos produtos vendidos e pela informação publicada.",
            "Funcionalidades externas, incluindo pagamentos e notificações, dependem da disponibilidade dos respetivos prestadores.",
          ],
        },
        {
          title: "2. Conta e segurança",
          paragraphs: [
            "O titular deve fornecer informação correta, proteger as credenciais e limitar acessos da equipa às funções necessárias. Atividade suspeita deve ser comunicada através da página de suporte.",
          ],
        },
        {
          title: "3. Planos e cobrança",
          paragraphs: [
            "Os preços e limites aplicáveis são os apresentados no momento da contratação. Assinaturas pagas são processadas pela Stripe e renovadas segundo a periodicidade escolhida, salvo cancelamento.",
            "Taxas de processamento de pagamentos, custos de estafetas e outros serviços de terceiros não estão incluídos na mensalidade, salvo indicação expressa.",
          ],
        },
        {
          title: "4. Responsabilidades do restaurante",
          paragraphs: [
            "O restaurante deve cumprir as regras fiscais, alimentares, laborais, de consumo e proteção de dados aplicáveis à sua atividade. Deve confirmar preços, horários, disponibilidade, alergénios e condições de entrega antes da publicação.",
          ],
        },
        {
          title: "5. Disponibilidade e suporte",
          paragraphs: [
            "São aplicadas medidas razoáveis de segurança, cópias e monitorização. Interrupções podem ocorrer por manutenção ou falhas externas; a Trimos procurará restaurar o serviço com a maior brevidade possível.",
          ],
        },
        {
          title: "6. Suspensão e encerramento",
          paragraphs: [
            "Contas podem ser suspensas por falta de pagamento, utilização abusiva, risco de segurança ou incumprimento legal. O cliente pode cancelar a assinatura pelo portal de faturação, mantendo acesso até ao fim do período já pago quando aplicável.",
          ],
        },
      ]}
    />
  );
}
