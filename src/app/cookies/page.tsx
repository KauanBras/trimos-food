import { LegalPage } from "@/components/marketing/legal-page";

export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Navegação"
      title="Política de cookies"
      introduction="A Trimos Food privilegia uma utilização simples e reduzida de armazenamento no navegador."
      sections={[
        {
          title: "Cookies essenciais",
          paragraphs: [
            "São usados cookies estritamente necessários para autenticação, manutenção segura da sessão, carrinho e preferências operacionais. Sem estes elementos, partes essenciais da plataforma não funcionam.",
          ],
        },
        {
          title: "Armazenamento local",
          paragraphs: [
            "O menu público pode usar armazenamento local para manter o carrinho até à conclusão do pedido. A autorização de som e notificações também pode ser recordada no dispositivo.",
          ],
        },
        {
          title: "Medição e terceiros",
          paragraphs: [
            "Ferramentas de pagamentos e infraestrutura podem definir elementos técnicos necessários à segurança e execução do respetivo serviço. Análises não essenciais só devem ser ativadas com mecanismo de consentimento adequado.",
          ],
        },
        {
          title: "Controlo",
          paragraphs: [
            "Pode eliminar cookies e dados locais nas definições do navegador. A eliminação pode terminar a sessão, limpar o carrinho e exigir nova autorização para notificações.",
          ],
        },
      ]}
    />
  );
}
