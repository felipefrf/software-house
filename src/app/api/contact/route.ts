import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, company, message } = await req.json();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Campos obrigatórios faltando." },
      { status: 400 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_EMAIL;

  if (!apiKey || !to) {
    return NextResponse.json(
      { error: "Serviço de email não configurado." },
      { status: 500 }
    );
  }

  const { RESEND_FROM = "onboarding@resend.dev" } = process.env;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1a1a1a">
      <h2 style="margin:0 0 16px;font-size:20px">Nova mensagem — Ápice</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 0;color:#78716c;width:90px">Nome</td><td style="padding:6px 0"><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#78716c">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(email)}" style="color:#0A2473">${escapeHtml(email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#78716c">Empresa</td><td style="padding:6px 0">${escapeHtml(company || "—")}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e8e4df;margin:16px 0" />
      <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(message)}</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      reply_to: email,
      subject: `Novo contato — ${name}${company ? ` (${company})` : ""}`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
