import { LegalPage } from "@/components/marketing/legal-page";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Proteção de dados"
      title="Política de privacidade"
      introduction="Explicamos de forma clara que dados são tratados, para que finalidade e que controlos estão disponíveis."
      sections={[
        {
          title: "Dados tratados",
          paragraphs: [
            "Tratamos dados de conta, contacto, configuração do restaurante, atividade operacional, pedidos, reservas e informação técnica necessária para segurança. Não guardamos números completos de cartão.",
          ],
        },
        {
          title: "Finalidades",
          paragraphs: [
            "Os dados são usados para prestar o serviço, autenticar utilizadores, processar operações solicitadas, apoiar clientes, prevenir fraude, cumprir obrigações e melhorar fiabilidade e desempenho.",
          ],
        },
        {
          title: "Responsabilidades",
          paragraphs: [
            "Para dados inseridos pelo restaurante sobre clientes e equipa, o restaurante atua normalmente como responsável pelo tratamento e a Trimos como prestador. O restaurante deve assegurar a base legal e fornecer a informação exigida aos titulares.",
          ],
        },
        {
          title: "Prestadores",
          paragraphs: [
            "Podemos recorrer a fornecedores de infraestrutura, base de dados, alojamento, pagamentos e notificações, designadamente Vercel, Supabase e Stripe, limitando o acesso ao necessário para cada serviço.",
          ],
        },
        {
          title: "Conservação e segurança",
          paragraphs: [
            "Os dados são conservados pelo período necessário à prestação, cumprimento legal e resolução de litígios. Aplicamos separação por restaurante, controlo de acesso, ligações cifradas e registos de auditoria.",
          ],
        },
        {
          title: "Direitos",
          paragraphs: [
            "Os titulares podem pedir acesso, correção, eliminação, limitação, portabilidade ou oposição quando aplicável. Pedidos devem ser enviados pela página de suporte, com informação suficiente para confirmar a identidade.",
          ],
        },
      ]}
    />
  );
}
