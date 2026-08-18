import type { EventDetails, PressReleaseInput } from "../lib/prompt";

export function emptyDetails(overrides: Partial<EventDetails> = {}): EventDetails {
  return {
    pemateri: null,
    poin_materi: null,
    jenis_lomba: null,
    hasil_pemenang: null,
    urutan_prosesi: null,
    makna_peringatan: null,
    bentuk_layanan: null,
    penerima_manfaat: null,
    agenda: null,
    kesepakatan: null,
    detail_tambahan: null,
    ...overrides,
  };
}

export const BRUS_INPUT: PressReleaseInput = {
  version: 2,
  nama_kegiatan: "Bimbingan Remaja Usia Sekolah (BRUS)",
  jenis_kegiatan: "bimbingan",
  tujuan: "Memberikan bimbingan pergaulan sehat kepada remaja usia sekolah sebagai bekal menjalani kehidupan setelah lulus.",
  penyelenggara: "Kantor Kementerian Agama Kota Depok",
  peserta: "Siswa dan siswi Pondok Pesantren Hidayatullah",
  jumlah_peserta: 30,
  tema: "Pergaulan sehat bagi remaja usia sekolah",
  pihak_terlibat: [
    { id: "person-siti", nama: "Siti Habibah", jabatan: "Penyuluh Agama Islam", peran: "Pemateri" },
  ],
  lokasi_lengkap: "Aula Kantor Kementerian Agama Kota Depok",
  lokasi_dateline: "DEPOK",
  tanggal: "Rabu (12/08/2026)",
  waktu: null,
  urutan_kegiatan: "Kegiatan diawali dengan pembukaan, dilanjutkan pemaparan materi oleh Siti Habibah, kemudian peserta mengikuti sesi tanya jawab, dan ditutup dengan rangkuman materi.",
  respons_peserta: "Peserta mengajukan pertanyaan pada sesi tanya jawab.",
  hasil_kegiatan: null,
  tindak_lanjut: null,
  detail_kegiatan: emptyDetails({
    pemateri: "Penyuluh Agama Islam, Siti Habibah",
    poin_materi: "Pergaulan sehat dan persiapan remaja menuju kehidupan setelah lulus",
  }),
  kutipan: [
    {
      id: "quote-sholahudin",
      nama: "H. Sholahudin Al Ayubi",
      jabatan: "Kasi Bimas Islam",
      isi: "jangan dianggep BRUS itu cuma pendidikan seks islami, tapi lebih ke bimbingan mempersiapkan anak2 usia sekolah secara pergaulan untuk ke jenjang membangun keluarga dan setelah lulus siap dalam hal pergaulan",
    },
  ],
  kontributor: "Sutan Arlie Johan",
};

export const LOMBA_INPUT: PressReleaseInput = {
  version: 2,
  nama_kegiatan: "Lomba Peringatan HUT Ke-81 RI",
  jenis_kegiatan: "lomba",
  tujuan: "Memperingati Hari Ulang Tahun Ke-81 Republik Indonesia serta mempererat kebersamaan pegawai.",
  penyelenggara: "Kantor Kementerian Agama Kota Depok",
  peserta: "Pegawai Kantor Kementerian Agama Kota Depok",
  jumlah_peserta: 80,
  tema: "Memperingati HUT Ke-81 RI bersama Kemenag",
  pihak_terlibat: [
    { id: "person-hasan", nama: "H. Hasan Basri", jabatan: "Kepala Subbagian Tata Usaha", peran: "Memberikan sambutan" },
  ],
  lokasi_lengkap: "Lapangan Kantor Kementerian Agama Kota Depok",
  lokasi_dateline: "DEPOK",
  tanggal: "Selasa (18/08/2026)",
  waktu: "Pukul 08.00 WIB",
  urutan_kegiatan: "Kegiatan diawali dengan pembukaan dan sambutan H. Hasan Basri, dilanjutkan pelaksanaan lomba balap karung dan makan kerupuk, kemudian diumumkan para pemenang, dan ditutup dengan foto bersama.",
  respons_peserta: "Pegawai mengikuti seluruh rangkaian lomba sesuai kelompok masing-masing.",
  hasil_kegiatan: "Pemenang setiap jenis lomba diumumkan setelah perlombaan selesai.",
  tindak_lanjut: null,
  detail_kegiatan: emptyDetails({
    jenis_lomba: "Balap karung dan makan kerupuk",
    hasil_pemenang: "Pemenang diumumkan untuk setiap jenis lomba setelah perlombaan selesai",
  }),
  kutipan: [],
  kontributor: "Sutan Arlie Johan dan Surya",
};

export const GEBER_INPUT: PressReleaseInput = {
  version: 2,
  nama_kegiatan: "Ziarah Maqburah sebagai rangkaian lanjutan GEBER MAS",
  jenis_kegiatan: "upacara",
  tujuan: "Mengenang dan menghormati jasa para pahlawan serta memperkuat kepedulian dan semangat kebangsaan.",
  penyelenggara: "Kantor Kementerian Agama Kota Depok",
  peserta: "Jajaran Kementerian Agama Kota Depok",
  jumlah_peserta: null,
  tema: null,
  pihak_terlibat: [
    { id: "person-dede", nama: "H. Dede Supriatna", jabatan: "Kepala Kantor Kementerian Agama Kota Depok", peran: "Memberikan arahan" },
  ],
  lokasi_lengkap: "Taman Makam Pahlawan (TMP) Kalimulya, Kota Depok",
  lokasi_dateline: "CILODONG",
  tanggal: "Senin (10/08/2026)",
  waktu: null,
  urutan_kegiatan: "Kegiatan diawali dengan upacara penghormatan kepada para pahlawan, kemudian dilanjutkan prosesi tabur bunga sebagai penghargaan atas jasa dan pengorbanan para pejuang bangsa.",
  respons_peserta: "Upacara ziarah dan tabur bunga berlangsung khidmat.",
  hasil_kegiatan: null,
  tindak_lanjut: null,
  detail_kegiatan: emptyDetails({
    urutan_prosesi: "Upacara penghormatan kepada pahlawan dan prosesi tabur bunga",
    makna_peringatan: "Mengenang jasa pahlawan dan meneruskan semangat pengabdian",
  }),
  kutipan: [
    {
      id: "quote-dede-1",
      nama: "H. Dede Supriatna",
      jabatan: "Kepala Kantor Kementerian Agama Kota Depok",
      isi: "Ziarah dan tabur bunga ini menjadi momentum bagi kita untuk mengenang jasa serta pengorbanan para pahlawan. Apa yang kita nikmati hari ini tidak terlepas dari perjuangan mereka dalam mempertahankan bangsa dan negara.",
    },
    {
      id: "quote-dede-2",
      nama: "H. Dede Supriatna",
      jabatan: "Kepala Kantor Kementerian Agama Kota Depok",
      isi: "Sebagai ASN Kementerian Agama, bentuk penghormatan kepada para pahlawan tidak cukup hanya dengan mengenang, tetapi juga dengan meneruskan semangat pengabdian melalui kerja yang berintegritas, pelayanan yang baik, serta memberikan manfaat nyata bagi masyarakat.",
    },
  ],
  kontributor: "Hari",
};
