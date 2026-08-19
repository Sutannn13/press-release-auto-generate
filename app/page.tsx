"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  Download,
  FileText,
  Loader2,
  Plus,
  Quote,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type {
  ArticleBlock,
  EventDetails,
  EventType,
  GeneratedPressRelease,
  PersonInput,
  PressReleaseInput,
  QuoteInput,
} from "@/lib/prompt";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPES,
  MAX_ARTICLE_BLOCKS,
  MAX_PARAGRAPH_BLOCKS,
  MIN_PARAGRAPH_BLOCKS,
} from "@/lib/prompt";
import {
  buildGeneratedChecklist,
  buildInputChecklist,
  renderApprovedQuote,
} from "@/lib/article";
import {
  DRAFT_STORAGE_KEY,
  parseStoredDraft,
  serializeDraft,
} from "@/lib/draft-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Field } from "@/components/press-release/field";
import { FileDropzone } from "@/components/press-release/file-dropzone";
import { QuoteFieldset } from "@/components/press-release/quote-fieldset";
import { PersonFieldset } from "@/components/press-release/person-fieldset";
import { FiveWOneHChecklist } from "@/components/press-release/five-w-one-h-checklist";
import { SectionHeading } from "@/components/press-release/section-heading";
import { Stepper } from "@/components/press-release/stepper";

type DetailForm = { [K in keyof EventDetails]: string };

interface FormState {
  nama_kegiatan: string;
  jenis_kegiatan: EventType | "";
  tujuan: string;
  penyelenggara: string;
  peserta: string;
  jumlah_peserta: string;
  tema: string;
  pihak_terlibat: PersonInput[];
  lokasi_lengkap: string;
  tanggalIso: string;
  waktu: string;
  datelineChoice: string;
  customDateline: string;
  urutan_kegiatan: string;
  respons_peserta: string;
  hasil_kegiatan: string;
  tindak_lanjut: string;
  detail_kegiatan: DetailForm;
  kutipan: QuoteInput[];
  kontributor: string;
}

const DATELINE_OPTIONS = [
  "DEPOK", "BEJI", "CIMANGGIS", "CILODONG", "CINERE", "CIPAYUNG",
  "BOJONGSARI", "LIMO", "PANCORAN MAS", "SAWANGAN", "SUKMAJAYA", "TAPOS",
] as const;
const CUSTOM_DATELINE = "__LAINNYA__";
let idSequence = 0;

function newId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSequence}`;
}

function blankDetails(): DetailForm {
  return {
    pemateri: "",
    poin_materi: "",
    jenis_lomba: "",
    hasil_pemenang: "",
    urutan_prosesi: "",
    makna_peringatan: "",
    bentuk_layanan: "",
    penerima_manfaat: "",
    agenda: "",
    kesepakatan: "",
    detail_tambahan: "",
  };
}

function initialForm(): FormState {
  return {
    nama_kegiatan: "",
    jenis_kegiatan: "",
    tujuan: "",
    penyelenggara: "Kantor Kementerian Agama Kota Depok",
    peserta: "",
    jumlah_peserta: "",
    tema: "",
    pihak_terlibat: [],
    lokasi_lengkap: "",
    tanggalIso: "",
    waktu: "",
    datelineChoice: "",
    customDateline: "",
    urutan_kegiatan: "",
    respons_peserta: "",
    hasil_kegiatan: "",
    tindak_lanjut: "",
    detail_kegiatan: blankDetails(),
    kutipan: [],
    kontributor: "",
  };
}

function deriveHariTanggal(dateIso: string): string {
  if (!dateIso) return "";
  const [year, month, day] = dateIso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(date);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${weekday} (${pad(day)}/${pad(month)}/${year})`;
}

function optional(value: string): string | null {
  return value.trim() || null;
}

function createFilename(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `press-release-kemenag-depok-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.docx`;
}

async function apiError(response: Response): Promise<{ message: string; details: string[] }> {
  try {
    const body = (await response.json()) as {
      error?: unknown;
      issues?: Array<{ field?: unknown; message?: unknown }>;
      violations?: Array<{ claim?: unknown; reason?: unknown }>;
    };
    const details = [
      ...(body.issues ?? []).map((item) => `${String(item.field || "data")}: ${String(item.message || "tidak valid")}`),
      ...(body.violations ?? []).map((item) => `${String(item.claim || "klaim")}: ${String(item.reason || "tidak didukung")}`),
    ];
    return { message: typeof body.error === "string" ? body.error : "Permintaan tidak dapat diproses.", details };
  } catch {
    return { message: "Permintaan tidak dapat diproses.", details: [] };
  }
}

export default function Home() {
  const [form, setForm] = useState<FormState>(() => initialForm());
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<GeneratedPressRelease | null>(null);
  const [sourceInput, setSourceInput] = useState<PressReleaseInput | null>(null);
  const [stale, setStale] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const previewRef = useRef<GeneratedPressRelease | null>(null);

  const dateline = form.datelineChoice === CUSTOM_DATELINE
    ? form.customDateline
    : form.datelineChoice;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const saved = parseStoredDraft<FormState>(raw);
        if (saved) {
          setForm(saved.form);
          setPreview(saved.preview);
          previewRef.current = saved.preview;
          setSourceInput(saved.sourceInput);
          setStale(saved.stale);
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          serializeDraft({ form, preview, sourceInput, stale }),
        );
      } catch {
        // Autosave tidak boleh mengganggu proses utama jika storage browser penuh.
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [form, preview, sourceInput, stale, hydrated]);

  function markChanged() {
    if (previewRef.current) setStale(true);
    setError(null);
    setErrorDetails([]);
  }

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    markChanged();
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateDetail(field: keyof DetailForm, value: string) {
    markChanged();
    setForm((current) => ({
      ...current,
      detail_kegiatan: { ...current.detail_kegiatan, [field]: value },
    }));
  }

  function addPerson() {
    updateForm("pihak_terlibat", [
      ...form.pihak_terlibat,
      { id: newId("person"), nama: "", jabatan: "", peran: "" },
    ]);
  }

  function updatePerson(index: number, field: "nama" | "jabatan" | "peran", value: string) {
    updateForm("pihak_terlibat", form.pihak_terlibat.map((person, itemIndex) => itemIndex === index ? { ...person, [field]: value } : person));
  }

  function addQuote() {
    updateForm("kutipan", [...form.kutipan, { id: newId("quote"), nama: "", jabatan: "", isi: "" }]);
  }

  function updateQuote(index: number, field: "nama" | "jabatan" | "isi", value: string) {
    updateForm("kutipan", form.kutipan.map((quote, itemIndex) => itemIndex === index ? { ...quote, [field]: value } : quote));
  }

  function buildRequest(): PressReleaseInput {
    return {
      version: 2,
      nama_kegiatan: form.nama_kegiatan.trim(),
      jenis_kegiatan: form.jenis_kegiatan as EventType,
      tujuan: form.tujuan.trim(),
      penyelenggara: form.penyelenggara.trim(),
      peserta: form.peserta.trim(),
      jumlah_peserta: form.jumlah_peserta.trim() ? Number(form.jumlah_peserta) : null,
      tema: optional(form.tema),
      pihak_terlibat: form.pihak_terlibat.map((person) => ({ ...person, nama: person.nama.trim(), jabatan: person.jabatan.trim(), peran: person.peran.trim() })),
      lokasi_lengkap: form.lokasi_lengkap.trim(),
      lokasi_dateline: dateline.trim().toLocaleUpperCase("id-ID"),
      tanggal: deriveHariTanggal(form.tanggalIso),
      waktu: optional(form.waktu),
      urutan_kegiatan: form.urutan_kegiatan.trim(),
      respons_peserta: optional(form.respons_peserta),
      hasil_kegiatan: optional(form.hasil_kegiatan),
      tindak_lanjut: optional(form.tindak_lanjut),
      detail_kegiatan: Object.fromEntries(
        Object.entries(form.detail_kegiatan).map(([key, value]) => [key, optional(value)]),
      ) as unknown as EventDetails,
      kutipan: form.kutipan.map((quote) => ({ ...quote, nama: quote.nama.trim(), jabatan: quote.jabatan.trim(), isi: quote.isi.trim() })),
      kontributor: form.kontributor.trim(),
    };
  }

  const formChecklist = useMemo(
    () => buildInputChecklist({
      nama_kegiatan: form.nama_kegiatan,
      jenis_kegiatan: form.jenis_kegiatan || undefined,
      tujuan: form.tujuan,
      penyelenggara: form.penyelenggara,
      peserta: form.peserta,
      lokasi_lengkap: form.lokasi_lengkap,
      lokasi_dateline: dateline,
      tanggal: deriveHariTanggal(form.tanggalIso),
      urutan_kegiatan: form.urutan_kegiatan,
    }),
    [form, dateline],
  );

  const previewChecklist = useMemo(
    () => preview && sourceInput
      ? buildGeneratedChecklist(sourceInput, preview.blocks)
      : preview?.checklist ?? [],
    [preview, sourceInput],
  );
  const previewParagraphCount = preview?.blocks.filter((block) => block.type === "paragraph").length ?? 0;
  const hasSupportingDetail = Boolean(
    form.tema.trim() ||
      form.jumlah_peserta.trim() ||
      form.respons_peserta.trim() ||
      form.hasil_kegiatan.trim() ||
      form.tindak_lanjut.trim() ||
      form.pihak_terlibat.length ||
      form.kutipan.length ||
      Object.values(form.detail_kegiatan).some((value) => value.trim()),
  );

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setErrorDetails([]);
    setDownloadError(null);
    const input = buildRequest();
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const details = await apiError(response);
        setErrorDetails(details.details);
        throw new Error(details.message);
      }
      const result = (await response.json()) as GeneratedPressRelease;
      previewRef.current = result;
      setPreview(result);
      setSourceInput(input);
      setStale(false);
      requestAnimationFrame(() => document.getElementById("preview")?.scrollIntoView({ behavior: "smooth" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuat draf.");
    } finally {
      setIsGenerating(false);
    }
  }

  function setPreviewState(next: GeneratedPressRelease) {
    previewRef.current = next;
    setPreview(next);
    setDownloadError(null);
  }

  function updateTitle(value: string) {
    if (!preview) return;
    setPreviewState({ ...preview, judul: value });
  }

  function updateParagraph(index: number, value: string) {
    if (!preview) return;
    setPreviewState({
      ...preview,
      blocks: preview.blocks.map((block, itemIndex) =>
        itemIndex === index && block.type === "paragraph" ? { ...block, text: value } : block,
      ),
    });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (!preview || index === 0 || index === preview.blocks.length - 1) return;
    const target = index + direction;
    if (target <= 0 || target >= preview.blocks.length - 1) return;
    const blocks = [...preview.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    setPreviewState({ ...preview, blocks });
  }

  function addBodyBlock() {
    if (
      !preview ||
      preview.blocks.length >= MAX_ARTICLE_BLOCKS ||
      preview.blocks.filter((block) => block.type === "paragraph").length >= MAX_PARAGRAPH_BLOCKS
    ) return;
    const blocks = [...preview.blocks];
    blocks.splice(blocks.length - 1, 0, {
      id: newId("block"),
      type: "paragraph",
      role: "body",
      text: "",
    });
    setPreviewState({ ...preview, blocks });
  }

  function removeBodyBlock(index: number) {
    if (!preview || preview.blocks.filter((block) => block.type === "paragraph").length <= MIN_PARAGRAPH_BLOCKS) return;
    const block = preview.blocks[index];
    if (block?.type !== "paragraph" || block.role !== "body") return;
    setPreviewState({ ...preview, blocks: preview.blocks.filter((_, itemIndex) => itemIndex !== index) });
  }

  function updateQuoteReview(index: number, changes: Partial<GeneratedPressRelease["quoteReviews"][number]>) {
    if (!preview) return;
    setPreviewState({
      ...preview,
      quoteReviews: preview.quoteReviews.map((review, itemIndex) => itemIndex === index ? { ...review, ...changes } : review),
    });
  }

  const quotesApproved = preview?.quoteReviews.every((review) => review.approved && review.selected) ?? false;
  const checklistComplete = previewChecklist.every((item) => item.status === "complete");
  const canDownload = Boolean(preview && sourceInput && foto && !stale && quotesApproved && checklistComplete);

  async function download() {
    if (!preview || !sourceInput || !canDownload || isDownloading) {
      setDownloadError(stale ? "Data form berubah. Generate ulang sebelum download." : "Lengkapi checklist, persetujuan kutipan, dan foto sebelum download.");
      return;
    }
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const data = new FormData();
      data.append("foto", foto!);
      data.append("data", JSON.stringify({
        version: 2,
        judul: preview.judul,
        blocks: preview.blocks,
        quoteReviews: preview.quoteReviews,
        sourceInput,
        kontributor: form.kontributor.trim(),
      }));
      const response = await fetch("/api/export-docx", { method: "POST", body: data });
      if (!response.ok) throw new Error((await apiError(response)).message);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = createFilename();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setDownloadError(caught instanceof Error ? caught.message : "Gagal membuat DOCX.");
    } finally {
      setIsDownloading(false);
    }
  }

  function resetDraft() {
    if (!window.confirm("Hapus seluruh data form dan draf yang tersimpan di browser?")) return;
    const clean = initialForm();
    setForm(clean);
    setPreview(null);
    previewRef.current = null;
    setSourceInput(null);
    setFoto(null);
    setStale(false);
    setError(null);
    setErrorDetails([]);
    setDownloadError(null);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  }

  function detailField(field: keyof DetailForm, label: string, placeholder: string) {
    return (
      <Field label={<>{label} <span className="font-normal text-muted-foreground">(opsional)</span></>}>
        {(id) => <Textarea id={id} rows={3} value={form.detail_kegiatan[field]} onChange={(event) => updateDetail(field, event.target.value)} placeholder={placeholder} />}
      </Field>
    );
  }

  return (
    <main className="relative z-10 min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-forest">Humas Kemenag Kota Depok</p>
              <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Press Release Generator V2</h1>
              <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Isi fakta 5W+1H, audit draf, setujui kutipan, lalu download dokumen Word.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={resetDraft}><RotateCcw /> Reset draf</Button>
            </div>
          </div>
          <div className="mt-6"><Stepper /></div>
        </header>

        <form onSubmit={generate} className="mt-8 rounded-2xl border border-border bg-card/90 p-5 shadow-xl sm:p-8">
          <SectionHeading icon={FileText} eyebrow="Fakta inti" title="Formula 5W+1H" description="Field inti wajib diisi dengan fakta. AI tidak akan menebak data yang kosong." />
          <div className="mt-7"><FiveWOneHChecklist items={formChecklist} /></div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2"><Field label="Nama kegiatan (What)" required>{(id) => <Input id={id} required maxLength={250} value={form.nama_kegiatan} onChange={(event) => updateForm("nama_kegiatan", event.target.value)} placeholder="Bimbingan Remaja Usia Sekolah (BRUS)" />}</Field></div>
            <Field label="Jenis kegiatan" required>{(id) => <Select name="jenis_kegiatan" required value={form.jenis_kegiatan} onValueChange={(value) => updateForm("jenis_kegiatan", value as EventType)}><SelectTrigger id={id} className="w-full"><SelectValue placeholder="Pilih jenis kegiatan" /></SelectTrigger><SelectContent>{EVENT_TYPES.map((type) => <SelectItem key={type} value={type}>{EVENT_TYPE_LABELS[type]}</SelectItem>)}</SelectContent></Select>}</Field>
            <Field label={<>Tema <span className="font-normal text-muted-foreground">(opsional)</span></>}>{(id) => <Input id={id} maxLength={500} value={form.tema} onChange={(event) => updateForm("tema", event.target.value)} />}</Field>
            <div className="md:col-span-2"><Field label="Tujuan/latar belakang (Why)" required hint="Gunakan tujuan resmi; jangan menulis hasil yang belum terjadi.">{(id) => <Textarea id={id} required minLength={20} maxLength={2000} rows={4} value={form.tujuan} onChange={(event) => updateForm("tujuan", event.target.value)} placeholder="Jelaskan alasan kegiatan diselenggarakan dan tujuan faktualnya..." />}</Field></div>
            <Field label="Penyelenggara/unit kerja (Who)" required>{(id) => <Input id={id} required maxLength={300} value={form.penyelenggara} onChange={(event) => updateForm("penyelenggara", event.target.value)} />}</Field>
            <Field label="Peserta/sasaran (Who)" required>{(id) => <Input id={id} required maxLength={500} value={form.peserta} onChange={(event) => updateForm("peserta", event.target.value)} placeholder="Siswa dan siswi Pondok Pesantren Hidayatullah" />}</Field>
            <Field label={<>Jumlah peserta <span className="font-normal text-muted-foreground">(opsional)</span></>}>{(id) => <Input id={id} type="number" min={0} max={1000000} value={form.jumlah_peserta} onChange={(event) => updateForm("jumlah_peserta", event.target.value)} />}</Field>
            <Field label="Tanggal (When)" required hint={form.tanggalIso ? `Akan tercetak: ${deriveHariTanggal(form.tanggalIso)}` : undefined}>{(id) => <DatePicker id={id} required value={form.tanggalIso} onChange={(value) => updateForm("tanggalIso", value)} />}</Field>
            <Field label={<>Waktu <span className="font-normal text-muted-foreground">(opsional)</span></>}>{(id) => <Input id={id} maxLength={50} value={form.waktu} onChange={(event) => updateForm("waktu", event.target.value)} placeholder="Pukul 09.00 WIB" />}</Field>
            <Field label="Lokasi lengkap (Where)" required>{(id) => <Input id={id} required maxLength={500} value={form.lokasi_lengkap} onChange={(event) => updateForm("lokasi_lengkap", event.target.value)} placeholder="Aula Kantor Kementerian Agama Kota Depok" />}</Field>
            <Field label="Lokasi dateline" required hint="Contoh pembuka: DEPOK (KEMENAG) –">{(id) => <Select name="lokasi_dateline" required value={form.datelineChoice} onValueChange={(value) => updateForm("datelineChoice", value)}><SelectTrigger id={id} className="w-full"><SelectValue placeholder="Pilih dateline" /></SelectTrigger><SelectContent>{DATELINE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}<SelectItem value={CUSTOM_DATELINE}>Lainnya…</SelectItem></SelectContent></Select>}</Field>
            {form.datelineChoice === CUSTOM_DATELINE ? <Field label="Dateline lainnya" required>{(id) => <Input id={id} required maxLength={50} className="uppercase" value={form.customDateline} onChange={(event) => updateForm("customDateline", event.target.value.toLocaleUpperCase("id-ID"))} />}</Field> : null}
            <div className="md:col-span-2"><Field label="Urutan kegiatan (How)" required hint="Sebutkan pembukaan, kegiatan utama, urutan proses, dan penutupan. Jangan hanya menulis ‘berjalan lancar’. ">{(id) => <Textarea id={id} required minLength={45} maxLength={4000} rows={6} value={form.urutan_kegiatan} onChange={(event) => updateForm("urutan_kegiatan", event.target.value)} placeholder="Kegiatan diawali..., kemudian..., dilanjutkan..., dan ditutup..." />}</Field></div>
            <Field label={<>Respons peserta <span className="font-normal text-muted-foreground">(opsional)</span></>}>{(id) => <Textarea id={id} rows={3} value={form.respons_peserta} onChange={(event) => updateForm("respons_peserta", event.target.value)} placeholder="Tuliskan respons yang benar-benar terlihat atau tercatat." />}</Field>
            <Field label={<>Hasil kegiatan <span className="font-normal text-muted-foreground">(opsional)</span></>}>{(id) => <Textarea id={id} rows={3} value={form.hasil_kegiatan} onChange={(event) => updateForm("hasil_kegiatan", event.target.value)} />}</Field>
            <div className="md:col-span-2"><Field label={<>Tindak lanjut <span className="font-normal text-muted-foreground">(opsional)</span></>}>{(id) => <Textarea id={id} rows={3} value={form.tindak_lanjut} onChange={(event) => updateForm("tindak_lanjut", event.target.value)} />}</Field></div>
          </div>
          {!hasSupportingDetail ? <Alert className="mt-6 border-amber-300 bg-amber-50/70"><AlertTriangle className="text-amber-700" /><AlertTitle>Isi minimal satu detail pendukung agar lima paragraf tidak menjadi filler: tema, jumlah/respons peserta, hasil, tindak lanjut, pihak hadir, kutipan, atau detail khusus.</AlertTitle></Alert> : null}

          {form.jenis_kegiatan ? <><Separator className="my-8" /><SectionHeading icon={Sparkles} eyebrow="Konteks" title={`Detail ${EVENT_TYPE_LABELS[form.jenis_kegiatan]}`} description="Field ini opsional, tetapi membuat naskah lebih spesifik dan mengurangi paragraf generik." /><div className="mt-5 grid gap-5 md:grid-cols-2">
            {form.jenis_kegiatan === "bimbingan" ? <>{detailField("pemateri", "Pemateri", "Nama dan jabatan lengkap")}{detailField("poin_materi", "Poin materi", "Materi faktual yang benar-benar disampaikan")}</> : null}
            {form.jenis_kegiatan === "lomba" ? <>{detailField("jenis_lomba", "Jenis lomba", "Daftar jenis lomba")}{detailField("hasil_pemenang", "Hasil/pemenang", "Nama pemenang hanya jika sudah resmi")}</> : null}
            {form.jenis_kegiatan === "upacara" ? <>{detailField("urutan_prosesi", "Urutan prosesi", "Urutan prosesi khusus")}{detailField("makna_peringatan", "Makna peringatan", "Makna yang dinyatakan resmi")}</> : null}
            {form.jenis_kegiatan === "pelayanan" ? <>{detailField("bentuk_layanan", "Bentuk layanan/aksi", "Layanan atau aksi yang dilakukan")}{detailField("penerima_manfaat", "Penerima manfaat", "Kelompok penerima manfaat")}</> : null}
            {form.jenis_kegiatan === "rapat" ? <>{detailField("agenda", "Agenda", "Agenda rapat atau kunjungan")}{detailField("kesepakatan", "Kesepakatan", "Kesepakatan yang sudah disetujui")}</> : null}
            {form.jenis_kegiatan === "lainnya" ? <div className="md:col-span-2">{detailField("detail_tambahan", "Detail tambahan", "Fakta tambahan yang relevan")}</div> : null}
          </div></> : null}

          <Separator className="my-8" />
          <SectionHeading icon={FileText} eyebrow="Pihak terlibat" title="Pejabat atau pihak yang hadir" description="Opsional. Isi nama, jabatan, dan perannya agar AI tidak menebak." action={<Button type="button" variant="outline" onClick={addPerson}><Plus /> Tambah pihak</Button>} />
          <div className="mt-5 space-y-4">{form.pihak_terlibat.map((person, index) => <PersonFieldset key={person.id} person={person} index={index} onChange={(field, value) => updatePerson(index, field, value)} onRemove={() => updateForm("pihak_terlibat", form.pihak_terlibat.filter((_, itemIndex) => itemIndex !== index))} />)}{form.pihak_terlibat.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Belum ada pihak yang ditambahkan.</p> : null}</div>

          <Separator className="my-8" />
          <SectionHeading icon={Quote} eyebrow="Narasumber" title="Kutipan langsung" description="Opsional. Tanpa kutipan, sistem memberi peringatan tetapi tidak mengarang ucapan." action={<Button type="button" variant="outline" onClick={addQuote}><Plus /> Tambah kutipan</Button>} />
          <div className="mt-5 space-y-4">{form.kutipan.map((quote, index) => <QuoteFieldset key={quote.id} index={index} canRemove quote={quote} onChange={(field, value) => updateQuote(index, field, value)} onRemove={() => updateForm("kutipan", form.kutipan.filter((_, itemIndex) => itemIndex !== index))} />)}{form.kutipan.length === 0 ? <Alert className="border-amber-300 bg-amber-50/70"><AlertTriangle className="text-amber-700" /><AlertTitle>Draf akan dibuat tanpa kutipan resmi.</AlertTitle></Alert> : null}</div>

          <Separator className="my-8" />
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Kontributor" required>{(id) => <Input id={id} required maxLength={300} value={form.kontributor} onChange={(event) => updateForm("kontributor", event.target.value)} placeholder="Nama kontributor" />}</Field>
            <Field label={<>Foto kegiatan <span className="font-normal text-muted-foreground">(wajib saat download)</span></>} hint="JPG/PNG maksimal 5 MB; tidak menghalangi generate.">{(id) => <FileDropzone id={id} name="foto" accept="image/jpeg,image/png" value={foto} onChange={setFoto} />}</Field>
          </div>

          {error ? <Alert variant="destructive" className="mt-6"><CircleAlert /><div><AlertTitle>{error}</AlertTitle>{errorDetails.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{errorDetails.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}</div></Alert> : null}
          <Button type="submit" disabled={isGenerating} className="mt-8 h-12 w-full bg-forest text-primary-foreground">{isGenerating ? <><Loader2 className="animate-spin" /> Generate dan audit fakta...</> : <><Sparkles /> Generate draf</>}</Button>
        </form>

        {preview ? <section id="preview" className="mt-8 scroll-mt-6 rounded-2xl border border-border bg-card/90 p-5 shadow-xl sm:p-8">
          <SectionHeading icon={FileText} eyebrow="Review wajib" title="Draf terurut dan teraudit" description="Periksa semua fakta. Kutipan harus dipilih dan disetujui sebelum export." />
          {stale ? <Alert className="mt-5 border-amber-300 bg-amber-50"><AlertTriangle className="text-amber-700" /><AlertTitle>Data form berubah setelah generate. Generate ulang sebelum download.</AlertTitle></Alert> : null}
          <div className="mt-6"><FiveWOneHChecklist items={previewChecklist} /></div>
          {preview.warnings.length ? <Alert className="mt-5"><AlertTriangle /><div><AlertTitle>Catatan kelengkapan</AlertTitle><ul className="mt-2 list-disc pl-5 text-sm">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></Alert> : null}

          <div className="mt-7"><Field label="Judul">{(id) => <Textarea id={id} rows={2} value={preview.judul} onChange={(event) => updateTitle(event.target.value)} className="font-display text-lg font-semibold" />}</Field></div>

          {preview.quoteReviews.length ? <div className="mt-7 space-y-5"><h3 className="font-display text-xl font-semibold">Persetujuan kutipan</h3>{preview.quoteReviews.map((review, index) => <div key={review.quoteId} className="rounded-xl border p-4">
            <p className="text-sm font-semibold">{review.nama} · {review.jabatan}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asli · terkunci</p><p className="mt-2 text-sm leading-6">{review.original}</p><Button type="button" size="sm" variant={review.selected === "original" ? "default" : "outline"} className="mt-3" onClick={() => updateQuoteReview(index, { selected: "original", approved: false })}>Pilih asli</Button></div>
              <div><Field label="Versi rapih">{(id) => <Textarea id={id} rows={5} value={review.cleaned} onChange={(event) => updateQuoteReview(index, { cleaned: event.target.value, selected: "cleaned", approved: false })} />}</Field><Button type="button" size="sm" variant={review.selected === "cleaned" ? "default" : "outline"} className="mt-3" onClick={() => updateQuoteReview(index, { selected: "cleaned", approved: false })}>Pilih versi rapih</Button></div>
            </div>
            <Button type="button" className="mt-4" variant={review.approved ? "default" : "outline"} disabled={!review.selected} onClick={() => updateQuoteReview(index, { approved: true })}>{review.approved ? <><Check /> Sudah disetujui</> : "Setujui pilihan kutipan"}</Button>
          </div>)}</div> : null}

          <div className="mt-8 flex items-center justify-between gap-4"><h3 className="font-display text-xl font-semibold">Urutan artikel</h3><Button type="button" variant="outline" onClick={addBodyBlock} disabled={preview.blocks.length >= MAX_ARTICLE_BLOCKS || previewParagraphCount >= MAX_PARAGRAPH_BLOCKS}><Plus /> Tambah paragraf</Button></div>
          <div className="mt-4 space-y-4">{preview.blocks.map((block, index) => <BlockEditor key={block.id} block={block} index={index} total={preview.blocks.length} canRemove={previewParagraphCount > MIN_PARAGRAPH_BLOCKS} quoteText={block.type === "quote" ? (() => { const review = preview.quoteReviews.find((item) => item.quoteId === block.quoteId); return review ? renderApprovedQuote(review, block.attributionStyle) : null; })() : null} onText={(value) => updateParagraph(index, value)} onMove={(direction) => moveBlock(index, direction)} onRemove={() => removeBodyBlock(index)} />)}</div>

          {downloadError ? <Alert variant="destructive" className="mt-6"><CircleAlert /><AlertTitle>{downloadError}</AlertTitle></Alert> : null}
          <Button type="button" disabled={!canDownload || isDownloading} onClick={download} className="mt-7 h-12 w-full bg-forest text-primary-foreground">{isDownloading ? <><Loader2 className="animate-spin" /> Membuat DOCX...</> : <><Download /> Download .docx{!foto ? " — pilih foto" : ""}</>}</Button>
        </section> : null}
      </div>
    </main>
  );
}

function BlockEditor({
  block,
  index,
  total,
  canRemove,
  quoteText,
  onText,
  onMove,
  onRemove,
}: {
  block: ArticleBlock;
  index: number;
  total: number;
  canRemove: boolean;
  quoteText: string | null;
  onText: (value: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const movable = index > 0 && index < total - 1;
  return (
    <div
      className="rounded-xl border border-border p-4"
      data-article-block
      data-block-type={block.type}
      data-block-role={block.type === "paragraph" ? block.role : "quote"}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-forest">{block.type === "quote" ? "quote" : block.role}</span>
        <div className="flex gap-1">
          <Button type="button" size="icon-sm" variant="ghost" disabled={!movable || index === 1} onClick={() => onMove(-1)} aria-label="Naikkan blok"><ArrowUp /></Button>
          <Button type="button" size="icon-sm" variant="ghost" disabled={!movable || index === total - 2} onClick={() => onMove(1)} aria-label="Turunkan blok"><ArrowDown /></Button>
          {block.type === "paragraph" && block.role === "body" ? <Button type="button" size="icon-sm" variant="ghost" disabled={!canRemove} onClick={onRemove} aria-label="Hapus paragraf" className="text-destructive"><Trash2 /></Button> : null}
        </div>
      </div>
      {block.type === "paragraph" ? <Textarea rows={block.role === "lead" ? 5 : 4} value={block.text} onChange={(event) => onText(event.target.value)} /> : <p className="rounded-lg bg-muted/50 p-4 text-sm italic leading-7">{quoteText || "Pilih dan setujui versi kutipan di atas."}</p>}
    </div>
  );
}
