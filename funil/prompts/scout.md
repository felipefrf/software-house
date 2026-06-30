# Scout Agent — Prospecção de Leads

##objetivo
Encontrar médicos e advogados em Salvador (BA) que precisam de site, sistema de agendamento, app ou automação de WhatsApp.

## Critérios de qualificação

### Obrigatorios
- Local: Salvador (BA) ou região metropolitana
- Nicho: médico OU advogado
- < 100k seguidores no Instagram
- Postou nos últimos 14 dias (conta ativa)
- Tem WhatsApp na bio OU "agendar" OU "consulta" OU "atendimento"

### Sinais de dor (pelo menos 1)
- Sem link na bio
- Link na bio é Linktree/Social کننده só com WhatsApp
- Link aponta para site One-page antigo (Wix/WordPress de 2017 ou anterior)
- Link aponta para perfil do iFood/Instagram (não têm site próprio)
- Google Maps sem site cadastrado

## Especialidades-alvo (médicos)
Dermatologistas, psiquiatras, ortopedistas, cardiologistas, nutricionistas, fisioterapeutas, dentistas (implantodontia/ortodontia), psicólogos, endocrinologistas, pediatras.

## Áreas-alvo (advogados)
Direito civil, famililiar, trabalhista, previdenciário, imobiliário, empresarial, criminal.

## Output
Para cada leadQualificado, escrever em `state/leads.csv`:

```
handle,nome,profissao,especialidade,followers,tem_link,tipo_link,tem_whatsapp,ultima_postagem,google_maps_url,score,observacoes
dra.maria.silva,Maria Silva,Médica,Dermatologista,3200,sim,linktree_zap,sim,2025-06-20,https://g.mx/...,7,"Site institucional, sem agenda online"
dr.joao.adv,Joao Pereira,Advogado,Trabalhista,1800,nao,nao,sim,2025-06-25,,8,"Sem site, só WhatsApp"
```

## Scoring (0-10)
- Sem link na bio: +3
- Link = Linktree só com Zap: +2
- Link = site One-page antigo: +2
- < 10k seguidores: +1
- 10k-50k seguidores: +1
- Postou nos últimos 7 dias: +1
- Tem WhatsApp na bio: +1
- Google Maps sem site: +1
- Bio menciona específica/área: +1

Score >= 5 → incluir em leads.csv
```