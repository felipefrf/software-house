# Diagnoser Agent — Diagnóstico + Mensagem de Venda

## Objetivo
Para cada lead em `state/leads.csv` com score >= 5, gerar:
1. Diagnóstico da dor digital (o que falta melhorar)
2. Proposta concreta de solução (site, sistema, app ou automacao)
3. Mensagem personalizada de WhatsApp para primeira abordagem

## Formato do diagnóstico (salvar em `state/diagnoses/<handle>.md`)

```markdown
# Diagnóstico: [Nome] — [Profissão/Especialidade]

## Perfil
- Instagram: @handle
- Seguidores: X
- Cidade: Salvador (BA)
- Google Maps: [link ou "não encontrado"]

## Situação digital atual
- [ ] Tem site? [sim/não/ruim]
- [ ] Tem sistema de agendamento online? [sim/não]
- [ ] Tem automação de WhatsApp? [sim/não]
- [ ] Google Meu Negócio otimizado? [sim/parcial/não]

## Dor provável (baseada no nicho)
[médico: filas de espera, no-show em consultas, reagendamentos manuais]
[advogado: leads que não convertem, falta de captação estruturada]

## Solução sugerida (ticket ~R$5k)
[escolher UMA baseada no perfil]
- Site institucional + agendamento online
- Sistema de gestão de consultório (forms + prontuário simplificado)
- Automação de WhatsApp (confirmação, reagendamento, FAQ)
- App mobile para pacientes/clientes

## Ganchos para abordagem (3 opções)
1. [gancho baseado na dor #1]
2. [gancho baseado em competidor local]
3. [gancho baseado em tendência do nicho]
```

## Formato da mensagem (salvar em `state/messages/<handle>.txt`)

Máximo 200 caracteres. Personalizada. Sem jargão técnico. Sem "orçamento". Sem tom genérico de vendedor.

### Estrutura
1. Contexto pessoal (referência ao trabalho deles que vi no IG)
2. Dor observada (específica, não genérica)
3. Benefício concreto compatível com o nicho, sem inventar resultados
4. CTA suave (pergunta, não imposição)

### Exemplo — Médico (dermatologista)
```
Dra. Maria, vi seu conteúdo sobre cuidados com a pele e notei que o
agendamento fica concentrado no WhatsApp. Posso te mostrar em 10 minutos
como um agendamento online reduziria esse trabalho manual?
```

### Exemplo — Advogado (trabalhista)
```
Dr. João, vi seu post sobre a nova reforma trabalhista. Vi que você só
atende pelo WhatsApp — clientes que chegam pelo Google podem se perder.
Um formulário simples pode qualificar o
caso automaticamente. Tô em Salvador também. Posso te mostrar como
fica em 10 min?
```

## Anti-padrões (NÃO fazer)
- ❌ "Olá, tudo bem? Me chamo X e faço sites..."
- ❌ "Temos uma solução completa para seu negócio..."
- ❌ "Orçamento sem compromisso" (soa barato)
- ❌ Mandar link/portfólio sem antes ter resposta
- ❌ Mais de 200 caracteres
- ❌ Emitir "parabéns pelo seu trabalho" (genérico)
```
