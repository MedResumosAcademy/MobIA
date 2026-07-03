// Política de Privacidade (LGPD) — página pública e estática. O texto é
// HONESTO para o estado atual do produto: apenas cookies essenciais de sessão,
// sem analytics/tracking; dados de navegação em imóveis só com opt-in do lead.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como a ImobIA coleta, usa e protege seus dados. Apenas cookies essenciais, sem rastreamento e sem venda de dados.",
};

// Tipografia "prose-like" com os tokens do tema (sem plugin externo).
const h2 = "font-serif text-2xl text-foreground mt-12 mb-4";
const p = "text-base leading-relaxed text-muted mb-4";
const li = "text-base leading-relaxed text-muted";

export default function PaginaPrivacidade() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
          Transparência
        </p>
        <h1 className="font-serif mt-3 text-4xl text-foreground sm:text-5xl">
          Política de Privacidade
        </h1>
        <p className="mt-4 text-sm text-subtle">Última atualização: 3 de julho de 2026</p>
        <div className="mt-8 h-px w-full bg-gold/60" aria-hidden="true" />
      </header>

      <section aria-labelledby="quem-somos">
        <h2 id="quem-somos" className={h2}>
          Quem somos
        </h2>
        <p className={p}>
          A <strong className="text-foreground">ImobIA</strong> é uma plataforma brasileira
          para o mercado imobiliário que conecta clientes, corretores e imobiliárias — do
          catálogo de imóveis à gestão comercial. Esta política explica, em linguagem
          simples, quais dados tratamos, por quê, e quais são os seus direitos sob a Lei
          Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
        </p>
      </section>

      <section aria-labelledby="dados-coletados">
        <h2 id="dados-coletados" className={h2}>
          Dados que coletamos
        </h2>
        <ul className="mb-4 list-disc space-y-3 pl-5 marker:text-brand">
          <li className={li}>
            <strong className="text-foreground">Dados de conta:</strong> nome e e-mail,
            usados para criar e autenticar o seu acesso à plataforma.
          </li>
          <li className={li}>
            <strong className="text-foreground">Perfil profissional do corretor:</strong>{" "}
            CRECI e CPF, coletados no cadastro para verificar a habilitação profissional.
            São usados exclusivamente para esse fim.
          </li>
          <li className={li}>
            <strong className="text-foreground">
              Comportamento de navegação em imóveis — somente com o seu consentimento:
            </strong>{" "}
            registrar interesse em imóveis (favoritos, simulações) para atendimento
            personalizado é <em>opt-in</em>. O corretor só vê dados de interesse de quem
            autorizou expressamente, e você pode revogar essa autorização a qualquer
            momento na sua conta.
          </li>
        </ul>
        <p className={p}>
          Não coletamos dados além dos necessários para a plataforma funcionar.
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies" className={h2}>
          Cookies
        </h2>
        <p className={p}>
          Usamos <strong className="text-foreground">apenas cookies essenciais</strong>: o
          cookie de sessão de autenticação, que mantém você conectado com segurança, e o
          registro da sua ciência deste aviso. Não usamos cookies de analytics, publicidade
          ou rastreamento de qualquer tipo.
        </p>
      </section>

      <section aria-labelledby="compartilhamento">
        <h2 id="compartilhamento" className={h2}>
          Compartilhamento
        </h2>
        <p className={p}>
          <strong className="text-foreground">Não vendemos seus dados.</strong> Seus dados
          não são compartilhados com terceiros para fins de marketing. O acesso interno é
          restrito ao necessário: por exemplo, um corretor só vê o interesse de clientes que
          consentiram em ser atendidos.
        </p>
      </section>

      <section aria-labelledby="direitos">
        <h2 id="direitos" className={h2}>
          Seus direitos (LGPD)
        </h2>
        <p className={p}>Você pode, a qualquer momento, solicitar:</p>
        <ul className="mb-4 list-disc space-y-2 pl-5 marker:text-brand">
          <li className={li}>
            <strong className="text-foreground">Acesso</strong> aos dados que mantemos sobre
            você;
          </li>
          <li className={li}>
            <strong className="text-foreground">Correção</strong> de dados incompletos ou
            desatualizados;
          </li>
          <li className={li}>
            <strong className="text-foreground">Exclusão</strong> dos seus dados e da sua
            conta;
          </li>
          <li className={li}>
            <strong className="text-foreground">Revogação</strong> de qualquer consentimento
            dado, como o de atendimento personalizado.
          </li>
        </ul>
        <p className={p}>
          Para exercer esses direitos, escreva para{" "}
          <a
            href="mailto:contato@imobia.com.br"
            className="font-medium text-brand-strong underline underline-offset-2"
          >
            contato@imobia.com.br
          </a>
          . Responderemos no prazo previsto em lei.
        </p>
      </section>

      <section aria-labelledby="seguranca">
        <h2 id="seguranca" className={h2}>
          Segurança
        </h2>
        <p className={p}>
          Seus dados trafegam com criptografia em trânsito (HTTPS) e ficam isolados por
          imobiliária: cada organização acessa somente os próprios registros. O acesso é
          protegido por autenticação e controles de permissão por papel (cliente, corretor,
          gestor).
        </p>
      </section>

      <footer className="mt-14 border-t border-border pt-6">
        <p className="text-sm text-subtle">
          Dúvidas sobre esta política? Fale com a gente em{" "}
          <a
            href="mailto:contato@imobia.com.br"
            className="font-medium text-brand-strong underline underline-offset-2"
          >
            contato@imobia.com.br
          </a>{" "}
          ou volte para a{" "}
          <Link
            href="/"
            className="font-medium text-brand-strong underline underline-offset-2"
          >
            página inicial
          </Link>
          .
        </p>
      </footer>
    </article>
  );
}
