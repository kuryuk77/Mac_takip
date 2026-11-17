# Maç Takip

UEFA'nın 55 üye ülkesinin liglerini tek yerden izlemek için statik bir web sitesi.

## Neler var

- **Ligler:** Bütün UEFA ülkeleri ve ligleri, UEFA kupaları (Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi).
- **Puan durumu:** Genel, iç saha ve deplasman tabloları, son 5 maç formu.
- **Fikstür:** Hafta hafta bütün maçlar ve skorlar (ilk yarı skoru dahil).
- **Hafta hafta:** Her haftada atılan gol sayısı, maç başına gol, en gollü maç, en farklı skor, ev, beraberlik ve deplasman dağılımı, 2,5 üst ve karşılıklı gol. Sezon rekorları ve haftalık gol grafiği. Örnek: *"Premier Lig 7. haftada kaç gol atıldı?"* → Premier League › Hafta Hafta › 7. Hafta.
- **Oyuncular:** Gol, asist, gol+asist, penaltı golü ve maç başına gol tablosu. Sıralanabilir, aranabilir, takıma göre süzülebilir.
- **Takım istatistikleri:** Atılan ve yenilen gol, gol yenmeyen ve gol atılamayan maçlar, karşılıklı gol ve 2,5 üst oranı, iç saha ve deplasmanda maç başına puan.
- **Takım ve oyuncu sayfaları:** Kadro, son ve sıradaki maçlar, turnuvalara göre oyuncu istatistikleri.
- **Karşılaştır:** Ligleri yan yana koyar (gol ortalaması, ev sahibi avantajı vb.). Bütün Avrupa'da gol ve asist sıralaması da burada.
- Takım ve oyuncu arama, açık ve koyu tema, mobil uyum.

## Veri kaynağı ve sınırları

Veri [football-data.org](https://www.football-data.org) API'sinden gelir. **Ücretsiz plan** şunları kapsar:
Premier League, Championship, Bundesliga, Serie A, LaLiga, Ligue 1, Eredivisie, Primeira Liga ve Şampiyonlar Ligi (gerçek API ile doğrulandı).
Diğer ligler (Süper Lig dahil) sitede "Ücretli planda" olarak görünür. Plan yükseltilirse ek işlem gerekmez, bir sonraki güncellemede kendiliğinden gelirler.

Ücretsiz planda **olmayan** istatistikler:

| İstatistik | Durum |
|---|---|
| Gol dakikaları (en erken ve en geç gol) | Ücretli planda gelir. Gelirse site kendiliğinden gösterir. |
| Sarı ve kırmızı kartlar | Ücretli planda gelir. Gelirse site kendiliğinden gösterir. |
| Korner, şut, pas, kritik pas | football-data.org'da yok. Bunlar için API-Football gibi başka bir kaynak gerekir. |

## Kurulum (GitHub Pages)

1. https://www.football-data.org/client/register adresinden ücretsiz kayıt ol. API anahtarı e-postayla gelir.
2. GitHub'da depo › **Settings › Secrets and variables › Actions › New repository secret**:
   ad `FOOTBALL_DATA_TOKEN`, değer API anahtarın.
3. **Settings › Pages › Build and deployment › Source:** `GitHub Actions` seç.
4. Kodu `main` dalına al. Ardından **Actions › "Veriyi güncelle ve yayınla" › Run workflow**.
   İlk çalışma yaklaşık 8 dakika sürer: ücretsiz plan dakikada 10 istek izin verir.
5. Site `https://<kullanıcı-adı>.github.io/<depo-adı>/` adresinde yayına girer. Veri her gün iki kez kendiliğinden güncellenir.

## Yerelde çalıştırma

```bash
FOOTBALL_DATA_TOKEN=anahtarın node scripts/fetch-data.mjs   # site/data/ altına JSON yazar
cd site && python3 -m http.server 8000                       # http://localhost:8000
```

Node 18 veya üstü gerekir. Başka bağımlılık yok.

## Yapı

```
scripts/leagues.mjs     UEFA ülkeleri ve lig kimlikleri (lig eklemek/çıkarmak için burayı düzenle)
scripts/fetch-data.mjs  API'den veriyi çekip site/data/*.json dosyalarına yazar
site/                   Statik site (index.html, app.js, styles.css). Derleme adımı yok.
.github/workflows/      Günlük veri güncelleme ve GitHub Pages yayını
```
