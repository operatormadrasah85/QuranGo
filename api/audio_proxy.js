// Al-Qur'an Go - Vercel Serverless Audio Proxy
// Memastikan unduhan audio MP3 murottal ke IndexedDB 100% bebas blokir CORS di Vercel.

const QARI_MAP = {
  Husary_128kbps: {
    everyAyah: 'Husary_128kbps',
    islamic: 'ar.husary',
    quranCom: 'Husary/mp3'
  },
  Alafasy_128kbps: {
    everyAyah: 'Alafasy_128kbps',
    islamic: 'ar.alafasy',
    quranCom: 'Alafasy/mp3'
  },
  Minshawy_Murattal_128kbps: {
    everyAyah: 'Minshawy_Murattal_128kbps',
    islamic: 'ar.minshawi',
    quranCom: 'Minshawi/Murattal/mp3'
  }
};

const SURAH_COUNTS = [
  0,
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,40,46,42,
  29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,
  11,8,3,9,5,4,7,3,6,3,
  5,4,5,6
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const query = req.query || {};

  if (query.ping !== undefined) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, service: 'alquran-go-audio-proxy-vercel' });
  }

  const qariKey = QARI_MAP[query.qari] ? query.qari : 'Husary_128kbps';
  const surah = parseInt(query.s, 10) || 0;
  const ayah = parseInt(query.a, 10) || 0;

  if (surah < 1 || surah > 114 || ayah < 1 || ayah > SURAH_COUNTS[surah]) {
    return res.status(400).json({ ok: false, error: 'Parameter surah/ayat tidak valid' });
  }

  let globalId = ayah;
  for (let i = 1; i < surah; i++) {
    globalId += SURAH_COUNTS[i];
  }

  const sss = String(surah).padStart(3, '0');
  const aaa = String(ayah).padStart(3, '0');
  const cfg = QARI_MAP[qariKey];

  const urls = [
    `https://everyayah.com/data/${cfg.everyAyah}/${sss}${aaa}.mp3`,
    `https://cdn.islamic.network/quran/audio/128/${cfg.islamic}/${globalId}.mp3`,
    `https://cdn.islamic.network/quran/audio/64/${cfg.islamic}/${globalId}.mp3`,
    `https://verses.quran.com/${cfg.quranCom}/${sss}${aaa}.mp3`
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const upstream = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (AlQuranGo/6.0 Vercel)' },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!upstream.ok) continue;
      const arrBuf = await upstream.arrayBuffer();
      if (arrBuf.byteLength > 800) {
        const buffer = Buffer.from(arrBuf);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', String(buffer.length));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.status(200).send(buffer);
      }
    } catch (e) {
      // Coba sumber berikutnya
    }
  }

  return res.status(502).json({ ok: false, error: 'Gagal mengambil audio dari server sumber' });
};
