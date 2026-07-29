# AGENTS.md — BelgeLab Geliştirme Rehberi

Bu dosya, BelgeLab deposunda çalışan Codex ve diğer kodlama ajanları için kalıcı proje talimatlarını içerir.

## 1. Proje Özeti

BelgeLab, kullanıcıların tarayıcı üzerinden PDF ve ofis belgesi işlemleri yapabildiği Türkçe bir web uygulamasıdır.

Ana hedefler:

- Araçlara hızlı ve anlaşılır erişim sağlamak.
- Kullanıcı dosyalarını mümkün olduğunca güvenli işlemek.
- SEO uyumlu araç landing page'leri oluşturmak.
- Mevcut çalışan davranışları koruyarak küçük ve kontrollü adımlarla ilerlemek.
- Gereksiz framework, bağımlılık ve mimari karmaşıklık eklememek.

## 2. Çalışma İlkeleri

Her görevde şu sırayı uygula:

1. İlgili dosyaları ve mevcut akışı incele.
2. Değişiklik kapsamını açıkça belirle.
3. En küçük ve en düşük riskli çözümü uygula.
4. Mevcut davranışları koru.
5. Statik kontrolleri ve mümkün olan testleri çalıştır.
6. Değişiklikleri raporla.
7. Açıkça istenmedikçe commit, push, deploy veya tag oluşturma.

Temel kurallar:

- Görev kapsamı dışındaki dosyalara dokunma.
- Gereksiz refactor yapma.
- Yeni framework veya paket ekleme.
- Kullanılmayan kod bırakma.
- Sessizce davranış değiştirme.
- Var olan kullanıcı akışını bozmadan ilerle.
- Hata durumlarında güvenli fallback kullan.
- Eksik bilgi varsa tahmin ederek ürün davranışı üretme; raporda belirt.

## 3. Depo ve Branch Kuralları

- Ana branch: `main`
- Doğrudan `main` üzerinde geliştirme yapma; açıkça istenirse istisna uygulanabilir.
- Her sprint veya görev için ayrı branch kullanılması tercih edilir.

Önerilen branch biçimi:

```text
feature/v1.4-tool-navigation
fix/pdf-compress-validation
seo/pdf-landing-internal-links
```

Açıkça istenmedikçe:

- Commit oluşturma.
- `git push` çalıştırma.
- Pull Request açma.
- Release tag oluşturma.
- Deploy yapma.

Git işlemlerinden önce her zaman çalışma ağacını kontrol et:

```bash
git status --short
git diff --check
git diff --stat
```

Yeni dosyaların normal `git diff --stat` çıktısında görünmeyebileceğini unutma. `git status --short` çıktısını ayrıca incele.

## 4. Proje Yapısı

Navigasyon ve araç davranışlarında önemli dosyalar:

```text
index.html
├── Araç kartları
├── #tools araç listesi
├── documentCreator paneli
├── quickTool paneli
├── converter alanı
└── PDF editor alanı

app.js
├── Genel uygulama davranışları
├── Dönüşüm araçları
└── PDF editor açma akışı

tools.js
├── Hızlı PDF araçları
└── quickTool paneli

creators.js
├── Word oluşturucu
├── Excel oluşturucu
└── PowerPoint oluşturucu

tool-navigation.js
├── Merkezi araç kayıt tablosu
├── `?tool=` parametresini okuma
├── `openTool(toolId)` yönlendirmesi
└── Güvenli fallback, scroll ve focus yönetimi

sw.js
└── PWA asset önbelleği ve cache sürümü

*-landing.html
├── Araç landing page içeriği
├── SEO meta etiketleri
├── CTA bağlantıları
└── FAQ / structured data
```

Dosya yapısı değişmişse önce gerçek depo içeriğini incele; bu listeyi körü körüne varsayma.

## 5. Merkezi Tool Navigation Sözleşmesi

Araçlara dışarıdan erişim için kararlı URL sözleşmesi:

```text
/?tool=<tool-id>
```

Örnekler:

```text
/?tool=pdf-compress
/?tool=pdf-to-word
/?tool=create-word
/?tool=pdf-editor
```

Kurallar:

- Tool ID değerleri küçük harfli `kebab-case` olmalı.
- Ana sayfadaki araç kartı `data-tool-id` taşımalı.
- Landing page CTA'sı aynı tool ID'yi kullanmalı.
- Merkezi registry'de karşılık bulunmalı.
- Bilinmeyen tool ID exception üretmemeli.
- Geçersiz araç güvenli biçimde `#tools` alanına düşmeli.
- URL işleme ilgili API scriptleri yüklendikten sonra çalışmalı.
- Kart tıklamaları ve URL üzerinden açılış mümkün olduğunca aynı merkezi akışı kullanmalı.

Mevcut global API'ler:

```text
window.BelgeLabNavigation.openTool(toolId)
window.BelgeLabTools.open(toolName)
window.BelgeLabTools.close()
window.BelgeLabCreators.open(toolName)
window.BelgeLabCreators.close()
window.BelgeLabApp.openOperation(operation)
window.BelgeLabApp.openEditor()
```

Bu nesneleri oluştururken mevcut global değerleri yanlışlıkla ezme. Gerekirse var olan nesneyi genişlet.

### Editör kararı

Şimdilik aşağıdaki üç pazarlama girişi aynı teknik hedefi kullanır:

- PDF Birleştir
- PDF Sayfalarını Düzenle
- PDF Düzenle

Merkezi kimlik:

```text
pdf-editor
```

Açıkça yeni ürün davranışı istenmedikçe farklı editor modları geliştirme.

## 6. JavaScript Kuralları

- Mevcut sade JavaScript mimarisini koru.
- Yeni framework veya router ekleme.
- İşlevleri küçük, açık ve yeniden kullanılabilir tut.
- DOM öğesi bulunamadığında gereksiz exception üretme.
- Event listener'ların iki kez bağlanmadığını kontrol et.
- Kart tıklaması merkezi ve eski listener tarafından çift çalışmamalı.
- Gizli veya disabled elemana focus verme.
- DOM görünür hâle geldikten sonra scroll ve focus uygula.
- Aynı anda gereksiz birden fazla geçici panel açık bırakma.
- Bilinmeyen değerleri doğrulamadan doğrudan işleme sokma.
- Global namespace kullanımını sınırlı ve kontrollü tut.

Bir işlevi mevcut anonim callback'ten ayırırken:

- Eski davranışı koru.
- Kart click akışını yeni işlev üzerinden çalıştır.
- Merkezi navigasyondan da aynı işlevi çağır.
- Fallback davranışını açıkça koru.

## 7. HTML ve Erişilebilirlik Kuralları

- Sayfada tek bir anlamlı `h1` bulunmalı.
- Başlık hiyerarşisini bozma.
- Buton ve bağlantı metinleri anlaşılır olmalı.
- CTA metni ile gerçek davranış birbiriyle uyumlu olmalı.
- Klavye kullanıcıları için focus yönetimini koru.
- Görünür olmayan alana odak taşıma.
- Mevcut ARIA etiketlerini ve semantik HTML yapısını bozma.
- Mobil görünümü etkileyen markup değişikliklerinde responsive davranışı kontrol et.

## 8. SEO Kuralları

Landing page değişikliklerinde aşağıdakileri kontrol et:

- Benzersiz `<title>`
- Benzersiz meta description
- Canonical URL
- Open Graph etiketleri
- Twitter kart etiketleri
- Tek `h1`
- Anlamlı ara başlıklar
- FAQ içeriği ile JSON-LD uyumu
- CTA'nın doğru araca yönlenmesi
- İç bağlantıların geçerli olması
- Türkçe metinde birleşmiş veya eksik kelime bulunmaması
- Sitemap gerekiyorsa güncellenmesi

Mevcut SEO etiketlerini görev dışında değiştirme.

## 9. Türkçe İçerik Kuralları

- Kullanıcıya görünen metinlerde doğal ve doğru Türkçe kullan.
- Türkçe karakterleri koru: `ç, ğ, ı, İ, ö, ş, ü`.
- Kelimelerin yanlış birleşmesini önle.
- Teknik terimlerin kullanıcı dostu karşılıklarını tercih et.
- CTA metinleri kısa ve eylem odaklı olmalı.
- Var olan marka yazımını koru: `BelgeLab`.
- Kullanıcının göreceği metni sebepsiz yere İngilizceleştirme.

## 10. CSS ve Tasarım Kuralları

- Mevcut mor ve tonlarına dayalı BelgeLab tasarım dilini koru.
- Açıkça istenmedikçe genel stil sistemini değiştirme.
- Küçük bir özellik için büyük CSS refactor yapma.
- Yeni sınıf eklemeden önce mevcut yardımcı sınıfları kontrol et.
- Masaüstü ve mobil davranışı birlikte düşün.
- Yatay taşma, kesilmiş metin ve üst üste binme oluşturma.
- Görsel değişiklik yoksa `style.css` dosyasına dokunma.

## 11. PWA ve Service Worker Kuralları

Yeni bir çekirdek asset eklenirse:

- `sw.js` içindeki açık cache listesinde yer alması gerekip gerekmediğini kontrol et.
- Gerekliyse asset yolunu mevcut biçimle tutarlı ekle.
- Cache adını kontrollü şekilde bir sürüm artır.
- Eski cache temizleme mantığının yeni sürümle uyumlu olduğunu doğrula.
- Yanlış asset yolunun service worker install işlemini bozabileceğini unutma.

Service worker değişikliği gerekmiyorsa yalnızca sürüm artırmak için dosyaya dokunma.

## 12. Test ve Doğrulama

Her görevde mümkün olan en uygun kontrolleri çalıştır.

Asgari statik kontroller:

```bash
git diff --check
git status --short
git diff --stat
```

JavaScript değişikliklerinde mevcut ortam destekliyorsa syntax kontrolü yap.

Yerel sunucu gerekiyorsa projede var olan yöntemi kullan. Yeni sunucu veya bağımlılık ekleme.

Tool navigation değişikliklerinde örnek URL'leri kontrol et:

```text
/?tool=pdf-compress
/?tool=pdf-to-word
/?tool=word-to-pdf
/?tool=dwg-to-pdf
/?tool=create-word
/?tool=pdf-editor
/?tool=gecersiz-arac
```

Kontrol başlıkları:

- Sayfa ve gerekli scriptler HTTP 200 yükleniyor mu?
- Doğru araç açılıyor mu?
- Doğru alana scroll yapılıyor mu?
- Focus görünür ve kullanılabilir bir kontrole gidiyor mu?
- Konsol hatası oluşuyor mu?
- Mevcut kart tıklamaları çalışıyor mu?
- Geçersiz araç güvenli fallback yapıyor mu?

Tarayıcı motoru, Playwright veya Selenium yoksa gerçek runtime testi yapılmış gibi raporlama. Kaynak kod ve statik sözleşme doğrulaması ile gerçek tarayıcı doğrulamasını açıkça ayır.

## 13. Değişiklik Kapsamı ve Güvenlik

Aşağıdaki işlemleri açıkça istenmedikçe yapma:

- Kullanıcı dosyalarını dış servise gönderme.
- Analytics veya takip kodu ekleme.
- Yeni üçüncü taraf bağımlılık ekleme.
- Backend veya sunucu yapılandırmasını değiştirme.
- Cloudflare Tunnel ayarlarını değiştirme.
- Docker yapılandırmasını değiştirme.
- Ortam değişkenlerini veya gizli bilgileri yazdırma.
- API anahtarı, token, parola veya kişisel veri commit etme.
- Büyük dosya silme veya toplu yeniden adlandırma.

Şüpheli veya hassas bir değer görürsen raporla; çıktıda gizli değeri tekrar gösterme.

## 14. Commit Kuralları

Yalnızca açıkça commit istenirse commit oluştur.

Commit öncesinde:

```bash
git diff --check
git status --short
git diff --stat
```

Commit mesajı:

- İngilizce olabilir.
- Kısa, eylem odaklı ve değişikliği açıklayıcı olmalı.
- Bir sprintte ilgisiz değişiklikleri tek commit'e toplama.

Örnekler:

```text
Add centralized tool navigation
Update landing page tool links
Add internal links to tool pages
Fix PDF converter selection
```

Commit oluşturduktan sonra hash değerini raporla. Açıkça istenmedikçe push yapma.

## 15. Deploy ve Release Kuralları

Deploy yalnızca açıkça onaylandığında yapılır.

Önerilen sıra:

```text
Analiz
→ Geliştirme
→ Kod incelemesi
→ Test
→ Commit
→ Push / Merge
→ Deploy
→ Canlı doğrulama
→ Tag
→ Sprint kapanışı
```

Release tag yalnızca:

- Değişiklikler canlıya alındıysa,
- Canlı URL kontrolleri geçtiyse,
- Kritik hata yoksa

oluşturulmalı.

Sürüm etiketi örneği:

```text
v1.4.0
```

## 16. Görev Sonu Raporu

Her geliştirme görevinden sonra şu biçimde raporla:

### Genel durum

- Tamamlandı / Kısmen tamamlandı / Engellendi

### Değiştirilen dosyalar

Her dosya için kısa açıklama ver.

### Uygulanan çözüm

Mimari ve davranış değişikliklerini özetle.

### Testler

- Çalıştırılan komutlar
- Başarılı kontroller
- Çalıştırılamayan kontroller ve nedeni

### Bilinen riskler

Gerçekten var olan riskleri yaz; yapılmamış testi yapılmış gibi gösterme.

### Git özeti

```bash
git diff --check
git diff --stat
git status --short
```

çıktılarını ekle.

### Sonraki adım

Commit, tarayıcı testi, deploy veya ek inceleme gerekip gerekmediğini açıkça belirt.

## 17. Kod İncelemesi Sonuç Formatı

Kod inceleme görevinde şu karar formatını kullan:

```text
A. Genel karar
- APPROVED
veya
- CHANGES REQUIRED

B. Bulgular
- Önem: BLOCKER / HIGH / MEDIUM / LOW
- Dosya ve satır
- Sorun
- Önerilen düzeltme

C. Doğrulananlar
- Kapsam
- Mapping bütünlüğü
- Script sırası
- Service worker sonucu
- Test sonucu

D. Git özeti
```

Hiç bulgu yoksa bunu açıkça söyle. Küçük stil tercihlerini blocker gibi sunma.

## 18. Öncelik Sırası

Karar verirken şu öncelik sırasını uygula:

1. Veri ve kullanıcı güvenliği
2. Mevcut çalışan davranışın korunması
3. Doğruluk
4. Erişilebilirlik
5. SEO bütünlüğü
6. Mobil uyumluluk
7. Performans
8. Kod sadeliği
9. Görsel iyileştirme

## 19. Son Kural

Görev açıkça farklı bir talimat vermiyorsa:

- Önce incele.
- Küçük ve güvenli değişiklik yap.
- Test et.
- Şeffaf raporla.
- Commit, push ve deploy için onay bekle.

# Project Documentation

`AGENTS.md` yalnızca zorunlu proje kurallarını içerir. Ayrıntılı ve uzun vadeli proje dokümantasyonu `/docs` altında tutulur:

- [Architecture](docs/architecture.md)
- [Coding Standards](docs/coding-standards.md)
- [SEO](docs/seo.md)
- [Quality Assurance](docs/qa.md)
- [Deployment](docs/deployment.md)
- [Release Management](docs/release.md)
- [Architecture Decision Records](docs/adr.md)
- [Engineering Roadmap](docs/roadmap.md)

Gelecekte katkıda bulunacak kişiler, büyük özellikleri uygulamadan önce ilgili dokümantasyonu incelemelidir. Büyük dokümantasyon içerikleri `AGENTS.md` içinde tekrar edilmemelidir.
