const axios = require('axios');

module.exports = async (req, res) => {
    // ID'yi yakala (id.m3u8 veya ?id= formatında fark etmez)
    const { id } = req.query;
    const channelId = id ? id.replace('.m3u8', '') : "50448";
    
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    try {
        // 1. Embed sayfasını al
        const pageResponse = await axios.get(`https://catcast.tv/embed/${channelId}`, { 
            headers: { "User-Agent": userAgent },
            timeout: 8000 
        });
        
        const html = pageResponse.data;

        // Daha agresif Token yakalayıcı (Birden fazla ihtimali tarar)
        const tokenMatch = html.match(/token[:=]\s?["']?([a-f0-9]{32})["']?|['"]token['"]\s?:\s?['"]([a-f0-9]{32})['"]/i);
        const token = tokenMatch ? (tokenMatch[1] || tokenMatch[2]) : null;
        
        if (!token) {
            // Token bulunamazsa sayfayı incelemek için hata döndür
            return res.status(403).send(`Hata: Token bulunamadi. Kanal (${channelId}) kapali olabilir veya IP engeli var. Bolge: ${process.env.VERCEL_REGION}`);
        }

        // 2. m3u8 linkini oluştur ve Catcast'ten ham veriyi çek
        const targetUrl = `https://autopilot.catcast.tv/mobile.m3u8?channel_id=${channelId}&token=${token}&server=v2.catcast.tv`;
        
        const response = await axios.get(targetUrl, {
            headers: { 
                "User-Agent": userAgent, 
                "Referer": "https://catcast.tv/" 
            }
        });

        let m3u8Content = response.data;
        
        // 3. .ts uzantılı dosyaların başına ana URL'yi ekle (Proxy görevi)
        const baseUrl = `https://v2.catcast.tv/hls/`;
        const modifiedLines = m3u8Content.split('\n').map(line => {
            if (line.startsWith('#') || line.trim() === '') return line;
            // Eğer satır tam bir link değilse başına baseUrl ekle
            return line.startsWith('http') ? line : baseUrl + line;
        });

        // Yanıtı M3U8 formatında gönder
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache'); // Önbelleği temizle
        res.status(200).send(modifiedLines.join('\n'));
        
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        res.status(status).send(`Sunucu Hatasi: ${error.message} - Bolge: ${process.env.VERCEL_REGION}`);
    }
};
