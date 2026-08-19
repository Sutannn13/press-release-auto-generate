import { expect, test, type Page } from "@playwright/test";

async function selectOption(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("alur browser V2: akses langsung, autosave, form dinamis, review, dan download", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Press Release Generator V2" })).toBeVisible();

  await page.getByLabel("Nama kegiatan (What)").fill("Bimbingan Remaja Usia Sekolah (BRUS)");
  await selectOption(page, "Jenis kegiatan", "Bimbingan / sosialisasi / seminar");
  await expect(page.getByLabel(/Pemateri/)).toBeVisible();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByLabel("Nama kegiatan (What)")).toHaveValue("Bimbingan Remaja Usia Sekolah (BRUS)");
  await expect(page.getByLabel(/Pemateri/)).toBeVisible();

  await page.getByLabel("Tujuan/latar belakang (Why)").fill("Memberikan bimbingan pergaulan sehat kepada remaja sebagai bekal setelah lulus.");
  await page.getByLabel("Peserta/sasaran (Who)").fill("30 siswa dan siswi Pondok Pesantren Hidayatullah");
  await page.getByLabel("Jumlah peserta").fill("30");
  await page.getByLabel("Lokasi lengkap (Where)").fill("Aula Kantor Kementerian Agama Kota Depok");
  await selectOption(page, "Lokasi dateline", "DEPOK");
  await page.getByLabel("Urutan kegiatan (How)").fill("Kegiatan diawali pembukaan, kemudian pemaparan materi, dilanjutkan sesi tanya jawab, dan ditutup dengan rangkuman.");
  await page.getByLabel("Kontributor").fill("Tim Humas");
  await page.getByLabel("Tanggal (When)").click();
  await page.locator('button[aria-label*="18"][aria-label*="Agustus"][aria-label*="2026"]').click();

  await page.getByRole("button", { name: "Tambah kutipan" }).click();
  await page.getByLabel("Nama narasumber").fill("H. Sholahudin Al Ayubi");
  await page.getByLabel("Jabatan").fill("Kasi Bimas Islam");
  await page.getByLabel("Isi kutipan").fill("BRUS merupakan bimbingan untuk mempersiapkan remaja dalam pergaulan dan kehidupan setelah lulus.");

  let generateCount = 0;
  await page.route("**/api/generate", async (route) => {
    generateCount += 1;
    const input = route.request().postDataJSON() as {
      lokasi_dateline: string;
      nama_kegiatan: string;
      penyelenggara: string;
      peserta: string;
      lokasi_lengkap: string;
      tanggal: string;
      tujuan: string;
      urutan_kegiatan: string;
      kutipan: Array<{ id: string; nama: string; jabatan: string; isi: string }>;
    };
    if (generateCount === 1) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          code: "INCOMPLETE_INPUT",
          error: "Data inti belum lengkap.",
          issues: [{ field: "tujuan", message: "Tujuan perlu diperjelas." }],
        }),
      });
      return;
    }
    const quote = input.kutipan[0];
    const lead = `${input.lokasi_dateline} (KEMENAG) – ${input.penyelenggara} menyelenggarakan ${input.nama_kegiatan} bagi ${input.peserta} di ${input.lokasi_lengkap}, ${input.tanggal}.`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 2,
        judul: "Kemenag Depok Gelar BRUS bagi Remaja Usia Sekolah",
        blocks: [
          { id: "lead", type: "paragraph", role: "lead", text: lead },
          { id: "body-1", type: "paragraph", role: "body", text: input.tujuan },
          { id: "body-2", type: "paragraph", role: "body", text: input.urutan_kegiatan },
          { id: "quote-1", type: "quote", quoteId: quote.id, attributionStyle: "full" },
          { id: "body-3", type: "paragraph", role: "body", text: "Peserta mengikuti rangkaian pemaparan materi dan sesi tanya jawab." },
          { id: "closing", type: "paragraph", role: "closing", text: `Kegiatan ini diarahkan untuk ${input.tujuan.toLocaleLowerCase("id-ID")}` },
        ],
        quoteReviews: [{
          quoteId: quote.id,
          nama: quote.nama,
          jabatan: quote.jabatan,
          original: quote.isi,
          cleaned: quote.isi,
          selected: null,
          approved: false,
        }],
        checklist: [],
        warnings: [],
        faktaDigunakan: [],
        audit: { passed: true, repaired: false, violations: [] },
      }),
    });
  });

  await page.getByRole("button", { name: "Generate draf" }).click();
  await expect(page.getByText("tujuan: Tujuan perlu diperjelas.")).toBeVisible();
  await page.getByRole("button", { name: "Generate draf" }).click();
  await expect(page.getByRole("heading", { name: "Draf terurut dan teraudit" })).toBeVisible();
  await expect(page.locator('[data-article-block]')).toHaveCount(6);
  await expect(page.getByRole("button", { name: /Download \.docx/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Download \.docx/ })).toContainText("pilih foto");

  const quoteBlock = page.locator('[data-block-type="quote"]');
  await quoteBlock.getByRole("button", { name: "Turunkan blok" }).click();
  await expect(page.locator('[data-article-block]').nth(4)).toHaveAttribute("data-block-type", "quote");

  await page.getByRole("button", { name: "Pilih asli" }).click();
  await page.getByRole("button", { name: "Setujui pilihan kutipan" }).click();
  await expect(page.getByRole("button", { name: "Sudah disetujui" })).toBeVisible();

  await page.route("**/api/export-docx", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      body: Buffer.from("PK-browser-test"),
    });
  });
  const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  await page.locator('input[type="file"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: photo });
  const downloadButton = page.getByRole("button", { name: /Download \.docx/ });
  await expect(downloadButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
  await expect(download.suggestedFilename()).toMatch(/^press-release-kemenag-depok-.*\.docx$/);

  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Draf terurut dan teraudit" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sudah disetujui" })).toBeVisible();
  await expect(page.locator('[data-article-block]').nth(4)).toHaveAttribute("data-block-type", "quote");
  await expect(page.getByRole("button", { name: /Download \.docx/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Download \.docx/ })).toContainText("pilih foto");
});
