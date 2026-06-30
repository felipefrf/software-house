"""
Scout — Prospecção de leads em Salvador (BA)
Saúde (médicos) e Jurídico (advogados)

Uso:
    python scout.py --niche medico --limit 50
    python scout.py --niche advogado --limit 50
    python scout.py --niche all --limit 100

Requer:
    - Apify API token (https://console.apify.com/account/integrations)
    - Variável de ambiente APIFY_API_TOKEN

Output:
    state/leads.csv (leads qualificados com score >= 5)
"""

import argparse
import csv
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    from apify_client import ApifyClient
except ImportError:
    print("Instale: pip install apify-client")
    sys.exit(1)


def load_env(env_path: Path) -> None:
    """Carrega variáveis de um arquivo .env (sem depender de source/export)."""
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


# Carrega .env do diretório raiz do projeto (funil/.env)
load_env(Path(__file__).resolve().parent.parent / ".env")

STATE_DIR = Path(__file__).resolve().parent.parent / "state"
LEADS_CSV = STATE_DIR / "leads.csv"

# Nichos e keywords para busca no Instagram
NICHE_KEYWORDS = {
    "medico": [
        "dermatologista salvador bahia",
        "psiquiatra salvador bahia",
        "ortopedista salvador bahia",
        "cardiologista salvador bahia",
        "endocrinologista salvador bahia",
        "pediatra salvador bahia",
        "dentista salvador bahia",
        "nutricionista salvador bahia",
        "fisioterapeuta salvador bahia",
        "clinica salvador bahia",
    ],
    "advogado": [
        "advogado trabalhista salvador",
        "advogado civil salvador",
        "advogado familia salvador",
        "advogado previdenciario salvador",
        "advogado imobiliario salvador",
        "advogado empresarial salvador",
        "advogado criminal salvador",
    ],
}

# Sinais de "link fraco" na bio
WEAK_LINK_PATTERNS = [
    "linktree",
    "wa.me",
    "whatsapp.com",
    "bit.ly",
    "instagram.com",
    "ifood.com.br",
    "facebook.com",
]

# Sinais de site antigo/fraco
OLD_SITE_PATTERNS = [
    "wix.com",
    "godaddy",
    "weebly",
    "wordpress.com",
]


def score_lead(
    followers: int,
    has_link: bool,
    link_type: str,
    has_whatsapp: bool,
    days_since_post: int,
    has_gmaps: bool,
    has_specialty: bool,
) -> int:
    """Calcula score de qualificação (0-10)."""
    score = 0

    # Link situation
    if not has_link:
        score += 3
    elif link_type == "linktree_zap":
        score += 2
    elif link_type == "old_site":
        score += 2
    elif link_type == "ifood_or_social":
        score += 2

    # Followers band
    if followers < 10000:
        score += 1
    elif 10000 <= followers < 50000:
        score += 1

    # Recent activity
    if days_since_post <= 7:
        score += 1
    elif days_since_post <= 14:
        score += 0

    # WhatsApp in bio
    if has_whatsapp:
        score += 1

    # Google Maps
    if has_gmaps:
        score += 1

    # Specialty in bio
    if has_specialty:
        score += 1

    return score


def classify_link(external_url: str) -> str:
    """Classifica o tipo de link na bio."""
    if not external_url:
        return "none"

    url_lower = external_url.lower()

    if any(p in url_lower for p in WEAK_LINK_PATTERNS):
        if "linktree" in url_lower:
            return "linktree_zap"
        if "wa.me" in url_lower or "whatsapp" in url_lower:
            return "whatsapp_direct"
        if "ifood" in url_lower:
            return "ifood_or_social"
        return "social_only"

    if any(p in url_lower for p in OLD_SITE_PATTERNS):
        return "old_site"

    return "has_site"


def has_whatsapp_in_bio(bio: str) -> bool:
    """Detecta se a bio menciona WhatsApp."""
    signals = ["whatsapp", "wa.me", "zap", "wpp", "(71)"]
    bio_lower = bio.lower()
    return any(s in bio_lower for s in signals)


def has_specialty_in_bio(bio: str, niche: str) -> bool:
    """Detecta se a bio menciona especialidade/área."""
    bio_lower = bio.lower()
    if niche == "medico":
        specialties = [
            "dermato", "psiquiat", "ortopedis", " cardio", "nutricio",
            "fisioter", "dentis", "psicolog", "endocrin", "pediatra",
            "medic", "doutor", "dra", "dr ",
        ]
    else:
        specialties = [
            "advogad", "direito", "juridic", "oab", "tribunal",
            "process", "caso", "consult",
        ]
    return any(s in bio_lower for s in specialties)


def run_scraper(keyword: str, limit: int, client: ApifyClient) -> list:
    """Executa o scraper do Apify para uma keyword."""
    # Apify Instagram Search Scraper (actor público da Apify)
    # Se falhar com "Actor not found", abra https://apify.com/apify/instagram-search-scraper
    # e troque actor_id pelo ID exibido na página (ou pelo nome "apify/instagram-search-scraper").
    actor_id = "apify/instagram-search-scraper"

    run_input = {
        "search": keyword,
        "searchType": "user",
        "searchLimit": limit,
        "resultsType": "details",
    }

    actor = client.actor(actor_id)
    run = actor.call(run_input=run_input)

    if run is None:
        print(f"  ⚠ Falhou para keyword: {keyword}")
        return []

    # run pode ser dict (na versão nova do client) ou objeto
    if isinstance(run, dict):
        run_id = run.get("id") or run.get("defaultDatasetId")
        default_dataset_id = run.get("defaultDatasetId")
    else:
        default_dataset_id = run.get("defaultDatasetId")

    if not default_dataset_id:
        print(f"  ⚠ Sem dataset para keyword: {keyword}")
        return []

    dataset = client.dataset(default_dataset_id)
    results = list(dataset.iterate_items())
    print(f"  ✓ {keyword}: {len(results)} perfis encontrados")
    return results


def process_leads(
    results: list, niche: str, min_score: int = 5
) -> list:
    """Processa resultados e filtra leads qualificados."""
    leads = []
    now = datetime.now()

    for profile in results:
        handle = profile.get("username", "").lstrip("@")
        if not handle:
            continue

        bio = profile.get("biography", "") or ""
        followers = profile.get("followersCount", 0) or 0
        external_url = profile.get("externalUrl", "") or ""
        last_post = profile.get("lastPosts", [{}])
        full_name = profile.get("fullName", "") or handle

        # Skip > 100k followers
        if followers > 100000:
            continue

        # Filtro anti "El Salvador" país / outras cidades homônimas
        bio_lower_full = bio.lower()
        name_lower = full_name.lower()
        handle_lower = handle.lower()
        reject_signals = [
            "el salvador",                # país
            "aguascalientes",             # México
            "san salvador",               # El Salvador capital
            "san salvador",
            "mexico", "méxico", "mexicano",
            "españa", "espanha", "madrid",
            "guatemala", "honduras", "nicaragua",
        ]
        combined = f"{bio_lower_full} {name_lower} {handle_lower}"
        if any(sig in combined for sig in reject_signals):
            continue
        # Sem sinal de Brasil/Salvador-Bahia também rejeita (evita falsos positivos)
        include_signals = [
            "salvador", "bahia", "ba", "ssa",
            "brasil", "br", "@71", "(71)",
            "barra", "pituba", "itapuã", "itororó",
        ]
        if not any(sig in combined for sig in include_signals):
            continue

        # Skip profiles with no recent activity (heuristic)
        # (Apify nem sempre traz lastPostDate; usamos lastPosts array length)
        days_since = 0
        if last_post:
            ts = last_post[0].get("timestamp")
            if ts:
                try:
                    post_dt = datetime.fromtimestamp(ts)
                    days_since = (now - post_dt).days
                except (ValueError, OSError):
                    days_since = 999
        else:
            days_since = 999

        # Skip inactive > 14 days
        if days_since > 14:
            continue

        has_zap = has_whatsapp_in_bio(bio)
        link_type = classify_link(external_url)
        has_link = bool(external_url)
        has_spec = has_specialty_in_bio(bio, niche)

        # Google Maps: checamos se bio menciona endereço/salvador
        gmaps_signal = "salvador" in bio.lower() or "rua" in bio.lower()
        has_gmaps = gmaps_signal

        score = score_lead(
            followers=followers,
            has_link=has_link,
            link_type=link_type,
            has_whatsapp=has_zap,
            days_since_post=days_since,
            has_gmaps=has_gmaps,
            has_specialty=has_spec,
        )

        if score < min_score:
            continue

        leads.append({
            "handle": handle,
            "nome": full_name,
            "profissao": "Médico" if niche == "medico" else "Advogado",
            "especialidade": bio[:80] if not has_spec else "",
            "followers": followers,
            "tem_link": "sim" if has_link else "nao",
            "tipo_link": link_type,
            "tem_whatsapp": "sim" if has_zap else "nao",
            "ultima_postagem": f"{days_since}d" if days_since < 999 else "?",
            "google_maps_url": "",
            "score": score,
            "observacoes": bio[:120].replace("\n", " "),
        })

    return leads


def dedupe(leads: list) -> list:
    seen = set()
    out = []
    for l in leads:
        h = l["handle"]
        if h in seen:
            continue
        seen.add(h)
        out.append(l)
    return out


def write_csv(leads: list, csv_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    exists = csv_path.exists()

    fieldnames = [
        "handle", "nome", "profissao", "especialidade", "followers",
        "tem_link", "tipo_link", "tem_whatsapp", "ultima_postagem",
        "google_maps_url", "score", "observacoes",
    ]

    mode = "a" if exists else "w"
    with open(csv_path, mode, newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if not exists:
            writer.writeheader()
        for row in leads:
            writer.writerow(row)

    print(f"\n✓ {len(leads)} leads escritos em {csv_path}")


def main():
    parser = argparse.ArgumentParser(description="Scout: prospecção de leads em Salvador")
    parser.add_argument("--niche", choices=["medico", "advogado", "all"], default="all")
    parser.add_argument("--limit", type=int, default=50, help="Perfis por keyword")
    parser.add_argument("--min-score", type=int, default=5)
    args = parser.parse_args()

    token = os.getenv("APIFY_API_TOKEN")
    if not token:
        print("Defina APIFY_API_TOKEN no ambiente.")
        sys.exit(1)

    niches = ["medico", "advogado"] if args.niche == "all" else [args.niche]

    client = ApifyClient(token)
    all_leads = []

    for niche in niches:
        keywords = NICHE_KEYWORDS[niche]
        print(f"\n🔍 Buscando {niche}s em Salvador... ({len(keywords)} keywords)")

        for kw in keywords:
            results = run_scraper(kw, args.limit, client)
            leads = process_leads(results, niche, args.min_score)
            all_leads.extend(leads)

    all_leads = dedupe(all_leads)
    all_leads.sort(key=lambda x: x["score"], reverse=True)

    write_csv(all_leads, LEADS_CSV)

    print(f"\n📊 Total: {len(all_leads)} leads qualificados (score >= {args.min_score})")
    print(f"   Médicos: {sum(1 for l in all_leads if l['profissao'] == 'Médico')}")
    print(f"   Advogados: {sum(1 for l in all_leads if l['profissao'] == 'Advogado')}")

    # Resumo top 10
    print("\nTop 10 leads:")
    for l in all_leads[:10]:
        print(f"  {l['score']:>2} @{l['handle']:<25} {l['profissao']:<10} {l['followers']:>7} followers | link={l['tem_link']:<3} zap={l['tem_whatsapp']}")


if __name__ == "__main__":
    main()