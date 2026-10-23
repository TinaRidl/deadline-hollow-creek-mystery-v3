const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = req.body || {};
  const name = normalize(body.name);
  const matches = [
    'evelyn price',
    'evelyn',
    'price'
  ].includes(name);

  if (matches) {
    return res.status(200).json({
      solved: true,
      message: 'You identified Evelyn Price as Jamie Mercer’s killer. She arranged a private meeting, killed Jamie to conceal her theft of scholarship money, and tried to stage the death as an accident. Jamie can finally be laid to rest with dignity.'
    });
  }

  return res.status(200).json({
    solved: false,
    message: 'That name is not correct. Revisit the evidence, the spirit notes, and the contradictions in the interviews.'
  });
}
