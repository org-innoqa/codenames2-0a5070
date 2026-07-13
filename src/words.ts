export const TURKISH_WORDS = [
  "Masa", "Kalem", "Dünya", "Göz", "Yol", "Kitap", "Su", "Ateş", "Toprak", "Hava",
  "Demir", "Altın", "Gümüş", "Yıldız", "Ay", "Güneş", "Deniz", "Göl", "Nehir", "Ağaç",
  "Çiçek", "Kedi", "Köpek", "Kuş", "Balık", "Aslan", "Kaplan", "Fil", "At", "Koyun",
  "Ev", "Okul", "İş", "Fabrika", "Hastane", "Doktor", "Öğretmen", "Polis", "Asker", "Kral",
  "Kraliçe", "Saray", "Kale", "Kılıç", "Kalkan", "Yay", "Ok", "Tekerlek", "Araba", "Uçak",
  "Tren", "Gemi", "Bisiklet", "Telefon", "Bilgisayar", "Saat", "Para", "Banka", "Dükkan", "Pazar",
  "Ekmek", "Peynir", "Zeytin", "Süt", "Kahve", "Çay", "Şeker", "Tuz", "Biber", "Elma",
  "Armut", "Muz", "Çilek", "Portakal", "Limon", "Karpuz", "Kavun", "Üzüm", "Kiraz", "Mavi",
  "Kırmızı", "Yeşil", "Sarı", "Siyah", "Beyaz", "Gri", "Kahverengi", "Turuncu", "Mor", "Yaz",
  "Kış", "İlkbahar", "Sonbahar", "Sabah", "Öğle", "Akşam", "Gece", "Rüzgar", "Bulut", "Yağmur",
  "Kar", "Şimşek", "Deprem", "Volkan", "Ada", "Kıta", "Ülke", "Şehir", "Köy", "Sokak",
  "Köprü", "Tünel", "Orman", "Çöl", "Mağara", "Vadi", "Dağ", "Tepe", "Bahçe", "Park",
  "Müze", "Tiyatro", "Sinema", "Kütüphane", "Sergi", "Konser", "Şarkı", "Müzik", "Resim", "Heykel",
  "Dans", "Oyun", "Spor", "Futbol", "Basketbol", "Tenis", "Yüzme", "Koşu", "Bisiklet", "Satranç",
  "Kart", "Zar", "Zaman", "Tarih", "Gelecek", "Geçmiş", "Rüya", "Hayal", "Gerçek", "Yalan",
  "Doğru", "Sır", "Anahtar", "Kilit", "Kapı", "Pencere", "Duvar", "Çatı", "Zemin", "Ayna"
];

export function getRandomWords(count: number): string[] {
  const shuffled = [...TURKISH_WORDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
