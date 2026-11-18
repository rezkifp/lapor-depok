import { useCallback, useEffect, useState } from "react";

import { Alert, Button, Field, Select, TextInput } from "../../components/form";
import { api } from "../../lib/api";

const TABS = [
  { value: "kategori", label: "Kategori" },
  { value: "instansi", label: "Instansi" },
  { value: "kecamatan", label: "Kecamatan / Kelurahan" },
];

const EMPTY_CATEGORY = { name: "", default_agency_id: "" };
const EMPTY_AGENCY = { name: "" };
const EMPTY_DISTRICT = { name: "" };
const EMPTY_VILLAGE = { district_id: "", name: "" };

export default function AdminMaster() {
  const [tab, setTab] = useState("kategori");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(EMPTY_CATEGORY);
  const [editingCategory, setEditingCategory] = useState(null);
  const [agencies, setAgencies] = useState([]);

  const [agencyList, setAgencyList] = useState([]);
  const [agency, setAgency] = useState(EMPTY_AGENCY);
  const [editingAgency, setEditingAgency] = useState(null);

  const [districts, setDistricts] = useState([]);
  const [district, setDistrict] = useState(EMPTY_DISTRICT);
  const [editingDistrict, setEditingDistrict] = useState(null);
  const [villages, setVillages] = useState([]);
  const [village, setVillage] = useState(EMPTY_VILLAGE);
  const [editingVillage, setEditingVillage] = useState(null);

  const loadCategories = useCallback(() => {
    return api.get("/admin/master/categories").then((rows) => setCategories(Array.isArray(rows) ? rows : []));
  }, []);

  const loadAgencies = useCallback(() => {
    return api.get("/admin/master/agencies").then((rows) => setAgencyList(Array.isArray(rows) ? rows : []));
  }, []);

  const loadDistricts = useCallback(() => {
    return api.get("/master/districts").then((rows) => setDistricts(Array.isArray(rows) ? rows : []));
  }, []);

  const loadVillages = useCallback((districtId) => {
    const suffix = districtId ? `?district_id=${districtId}` : "";
    return api.get(`/admin/master/villages${suffix}`).then((rows) => setVillages(Array.isArray(rows) ? rows : []));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([loadCategories(), loadAgencies(), loadDistricts()])
      .then(() => {
        if (active) setError("");
      })
      .catch(() => {
        if (active) setError("Gagal memuat data master. Coba lagi.");
      });
    return () => {
      active = false;
    };
  }, [loadCategories, loadAgencies, loadDistricts]);

  useEffect(() => {
    if (tab !== "kecamatan") return;
    let active = true;
    loadDistricts()
      .then(() => {
        if (active) setError("");
      })
      .catch(() => {
        if (active) setError("Gagal memuat data kecamatan. Coba lagi.");
      });
    return () => {
      active = false;
    };
  }, [tab, loadDistricts]);

  // ---------------- Kategori ----------------

  const submitCategory = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const payload = { name: category.name.trim() };
    const agencyId = category.default_agency_id ? Number(category.default_agency_id) : null;
    if (agencyId) payload.default_agency_id = agencyId;
    try {
      if (editingCategory) {
        await api.patch(`/admin/master/categories/${editingCategory.id}`, payload);
        setNotice("Kategori berhasil diperbarui.");
      } else {
        await api.post("/admin/master/categories", payload);
        setNotice("Kategori berhasil ditambahkan.");
      }
      setEditingCategory(null);
      setCategory(EMPTY_CATEGORY);
      await loadCategories();
    } catch (err) {
      setError(err.message || "Gagal menyimpan kategori.");
    }
  };

  const startEditCategory = (item) => {
    setEditingCategory(item);
    setCategory({ name: item.name, default_agency_id: item.default_agency_id ? String(item.default_agency_id) : "" });
  };

  const removeCategory = async (id) => {
    if (!window.confirm("Yakin ingin menghapus kategori ini? Data yang masih dipakai laporan tidak dapat dihapus.")) return;
    try {
      await api.delete(`/admin/master/categories/${id}`);
      setNotice("Kategori berhasil dihapus.");
      await loadCategories();
    } catch (err) {
      setError(err.message || "Gagal menghapus kategori.");
    }
  };

  // ---------------- Instansi ----------------

  const submitAgency = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      if (editingAgency) {
        await api.patch(`/admin/master/agencies/${editingAgency.id}`, { name: agency.name.trim() });
        setNotice("Instansi berhasil diperbarui.");
      } else {
        await api.post("/admin/master/agencies", { name: agency.name.trim() });
        setNotice("Instansi berhasil ditambahkan.");
      }
      setEditingAgency(null);
      setAgency(EMPTY_AGENCY);
      await loadAgencies();
    } catch (err) {
      setError(err.message || "Gagal menyimpan instansi.");
    }
  };

  const startEditAgency = (item) => {
    setEditingAgency(item);
    setAgency({ name: item.name });
  };

  const removeAgency = async (id) => {
    if (!window.confirm("Yakin ingin menghapus instansi ini?")) return;
    try {
      await api.delete(`/admin/master/agencies/${id}`);
      setNotice("Instansi berhasil dihapus.");
      await loadAgencies();
    } catch (err) {
      setError(err.message || "Gagal menghapus instansi.");
    }
  };

  // ---------------- Kecamatan / Kelurahan ----------------

  const submitDistrict = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      if (editingDistrict) {
        await api.patch(`/admin/master/districts/${editingDistrict.id}`, { name: district.name.trim() });
        setNotice("Kecamatan berhasil diperbarui.");
      } else {
        await api.post("/admin/master/districts", { name: district.name.trim() });
        setNotice("Kecamatan berhasil ditambahkan.");
      }
      setEditingDistrict(null);
      setDistrict(EMPTY_DISTRICT);
      await loadDistricts();
    } catch (err) {
      setError(err.message || "Gagal menyimpan kecamatan.");
    }
  };

  const startEditDistrict = (item) => {
    setEditingDistrict(item);
    setDistrict({ name: item.name });
  };

  const removeDistrict = async (id) => {
    if (!window.confirm("Yakin ingin menghapus kecamatan ini?")) return;
    try {
      await api.delete(`/admin/master/districts/${id}`);
      setNotice("Kecamatan berhasil dihapus.");
      await loadDistricts();
    } catch (err) {
      setError(err.message || "Gagal menghapus kecamatan.");
    }
  };

  const submitVillage = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    const payload = { name: village.name.trim() };
    const districtId = village.district_id ? Number(village.district_id) : null;
    if (!editingVillage) {
      if (!districtId) {
        setError("Pilih kecamatan induk untuk menambah kelurahan.");
        return;
      }
      payload.district_id = districtId;
    }
    try {
      if (editingVillage) {
        await api.patch(`/admin/master/villages/${editingVillage.id}`, payload);
        setNotice("Kelurahan berhasil diperbarui.");
      } else {
        await api.post("/admin/master/villages", payload);
        setNotice("Kelurahan berhasil ditambahkan.");
      }
      setEditingVillage(null);
      setVillage(EMPTY_VILLAGE);
      await loadVillages(village.district_id ? Number(village.district_id) : undefined);
    } catch (err) {
      setError(err.message || "Gagal menyimpan kelurahan.");
    }
  };

  const startEditVillage = (item) => {
    setEditingVillage(item);
    setVillage({ district_id: item.district_id ? String(item.district_id) : "", name: item.name });
  };

  const removeVillage = async (id) => {
    if (!window.confirm("Yakin ingin menghapus kelurahan ini?")) return;
    try {
      await api.delete(`/admin/master/villages/${id}`);
      setNotice("Kelurahan berhasil dihapus.");
      await loadVillages(village.district_id ? Number(village.district_id) : undefined);
    } catch (err) {
      setError(err.message || "Gagal menghapus kelurahan.");
    }
  };

  const resetVillageForm = () => {
    setEditingVillage(null);
    setVillage(EMPTY_VILLAGE);
  };

  const resetDistrictForm = () => {
    setEditingDistrict(null);
    setDistrict(EMPTY_DISTRICT);
  };

  const cancelForms = () => {
    setEditingCategory(null);
    setCategory(EMPTY_CATEGORY);
    setEditingAgency(null);
    setAgency(EMPTY_AGENCY);
    setEditingDistrict(null);
    setDistrict(EMPTY_DISTRICT);
    setEditingVillage(null);
    setVillage(EMPTY_VILLAGE);
  };

  const agencyOptions = agencies.map((item) => (
    <option key={item.id} value={String(item.id)}>
      {item.name}
    </option>
  ));

  const districtOptions = districts.map((item) => (
    <option key={item.id} value={String(item.id)}>
      {item.name}
    </option>
  ));

  const villageOptions = villages.map((item) => (
    <option key={item.id} value={String(item.id)}>
      {item.name}
    </option>
  ));

  const selectAgency = (value) => setCategory({ ...category, default_agency_id: value });

  const selectDistrict = (value) => {
    setVillage((current) => ({ ...current, district_id: value }));
    return loadVillages(value ? Number(value) : undefined);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue">Panel Admin</p>
          <h1 className="mt-1 text-2xl font-extrabold text-navy sm:text-3xl">Master Data</h1>
          <p className="mt-1 text-sm text-muted">
            Kelola kategori, instansi, kecamatan, dan kelurahan untuk pengaduan warga.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              id={`master-tab-${item.value}`}
              onClick={() => setTab(item.value)}
              className={`min-h-control rounded-btn px-4 text-sm font-semibold transition ${
                tab === item.value ? "bg-gold text-navy" : "border border-line text-muted hover:bg-surface"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {tab === "kategori" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="card p-5">
              <h2 className="text-base font-extrabold text-navy">{editingCategory ? "Ubah Kategori" : "Tambah Kategori"}</h2>
              <form onSubmit={submitCategory} className="mt-4 grid gap-3">
                <Field label="Nama kategori" htmlFor="cat-name" required>
                  <TextInput
                    id="cat-name"
                    value={category.name}
                    onChange={(event) => setCategory({ ...category, name: event.target.value })}
                    placeholder="Contoh: Infrastruktur"
                    required
                  />
                </Field>
                <Field label="Instansi default" htmlFor="cat-agency">
                  <Select id="cat-agency" value={category.default_agency_id} onChange={selectAgency}>
                    <option value="">Tidak ada default</option>
                    {agencyOptions}
                  </Select>
                </Field>
                <div className="flex items-center gap-2">
                  <Button type="submit" id="cat-submit">
                    {editingCategory ? "Perbarui" : "Tambah"}
                  </Button>
                  {editingCategory ? (
                    <Button type="button" variant="outline" onClick={cancelForms}>
                      Batal
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                      <th className="px-5 py-3">Nama</th>
                      <th className="px-3 py-3">Instansi default</th>
                      <th className="px-3 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                        <td className="px-5 py-3 font-semibold text-ink">{item.name}</td>
                        <td className="px-3 py-3 text-muted">{item.default_agency?.name ?? "-"}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="min-h-control rounded-btn px-2 text-xs font-bold text-blue hover:bg-surface"
                            onClick={() => startEditCategory(item)}
                          >
                            Ubah
                          </button>{" "}
                          <button
                            type="button"
                            className="min-h-control rounded-btn px-2 text-xs font-bold text-status-ditolak-fg hover:bg-red-50"
                            onClick={() => removeCategory(item.id)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {categories.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Belum ada data kategori.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "instansi" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="card p-5">
              <h2 className="text-base font-extrabold text-navy">{editingAgency ? "Ubah Instansi" : "Tambah Instansi"}</h2>
              <form onSubmit={submitAgency} className="mt-4 grid gap-3">
                <Field label="Nama instansi" htmlFor="agency-name" required>
                  <TextInput
                    id="agency-name"
                    value={agency.name}
                    onChange={(event) => setAgency({ ...agency, name: event.target.value })}
                    placeholder="Contoh: Dinas Lingkungan Hidup"
                    required
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button type="submit" id="agency-submit">
                    {editingAgency ? "Perbarui" : "Tambah"}
                  </Button>
                  {editingAgency ? (
                    <Button type="button" variant="outline" onClick={cancelForms}>
                      Batal
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                      <th className="px-5 py-3">Nama instansi</th>
                      <th className="px-3 py-3">Dipakai laporan</th>
                      <th className="px-3 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencyList.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                        <td className="px-5 py-3 font-semibold text-ink">{item.name}</td>
                        <td className="px-3 py-3 text-muted">{item.used_by_reports ?? 0}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="min-h-control rounded-btn px-2 text-xs font-bold text-blue hover:bg-surface"
                            onClick={() => startEditAgency(item)}
                          >
                            Ubah
                          </button>{" "}
                          <button
                            type="button"
                            className="min-h-control rounded-btn px-2 text-xs font-bold text-status-ditolak-fg hover:bg-red-50"
                            onClick={() => removeAgency(item.id)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {agencyList.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Belum ada data instansi.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "kecamatan" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="text-base font-extrabold text-navy">{editingDistrict ? "Ubah Kecamatan" : "Tambah Kecamatan"}</h2>
                <form onSubmit={submitDistrict} className="mt-4 grid gap-3">
                  <Field label="Nama kecamatan" htmlFor="district-name" required>
                    <TextInput
                      id="district-name"
                      value={district.name}
                      onChange={(event) => setDistrict({ ...district, name: event.target.value })}
                      placeholder="Contoh: Beji"
                      required
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Button type="submit" id="district-submit">{editingDistrict ? "Perbarui" : "Tambah"}</Button>
                    {editingDistrict ? (
                      <Button type="button" variant="outline" onClick={cancelForms}>
                        Batal
                      </Button>
                    ) : null}
                  </div>
                </form>
              </div>

              <div className="card p-5">
                <h2 className="text-base font-extrabold text-navy">{editingVillage ? "Ubah Kelurahan" : "Tambah Kelurahan"}</h2>
                <form onSubmit={submitVillage} className="mt-4 grid gap-3">
                  {!editingVillage ? (
                    <Field label="Kecamatan induk" htmlFor="village-district" required>
                      <Select
                        id="village-district"
                        value={village.district_id}
                        onChange={(event) => setVillage({ ...village, district_id: event.target.value })}
                      >
                        <option value="">Pilih kecamatan</option>
                        {districtOptions}
                      </Select>
                    </Field>
                  ) : null}
                  <Field label="Nama kelurahan" htmlFor="village-name" required>
                    <TextInput
                      id="village-name"
                      value={village.name}
                      onChange={(event) => setVillage({ ...village, name: event.target.value })}
                      placeholder="Contoh: Kemiri Muka"
                      required
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Button type="submit" id="village-submit">
                      {editingVillage ? "Perbarui" : "Tambah"}
                    </Button>
                    {editingVillage ? (
                      <Button type="button" variant="outline" onClick={cancelForms}>
                        Batal
                      </Button>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4">
                <h2 className="text-base font-extrabold text-navy">Daftar Kecamatan</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                      <th className="px-5 py-3">Nama kecamatan</th>
                      <th className="px-3 py-3">Jumlah kelurahan</th>
                      <th className="px-3 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districts.map((item) => (
                      <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                        <td className="px-5 py-3 font-semibold text-ink">{item.name}</td>
                        <td className="px-3 py-3 text-muted">{item.village_count ?? 0}</td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            className="min-h-control rounded-btn px-2 text-xs font-bold text-blue hover:bg-surface"
                            onClick={() => startEditDistrict(item)}
                          >
                            Ubah
                          </button>{" "}
                          <button
                            type="button"
                            className="min-h-control rounded-btn px-2 text-xs font-bold text-status-ditolak-fg hover:bg-red-50"
                            onClick={() => removeDistrict(item.id)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {districts.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Belum ada data kecamatan.</p> : null}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "kecamatan" ? (
          <div className="mt-4 card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h2 className="text-base font-extrabold text-navy">Daftar Kelurahan</h2>
              <div className="flex min-w-[280px] items-center gap-2">
                <Select
                  value={village.district_id}
                  onChange={(event) => {
                    setVillage({ ...village, district_id: event.target.value });
                    loadVillages(event.target.value ? Number(event.target.value) : undefined);
                  }}
                >
                  <option value="">Semua kecamatan</option>
                  {districtOptions}
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left text-xs font-bold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">Nama kelurahan</th>
                    <th className="px-3 py-3">Kecamatan</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {villages.map((item) => (
                    <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface/60">
                      <td className="px-5 py-3 font-semibold text-ink">{item.name}</td>
                      <td className="px-3 py-3 text-muted">{item.district?.name ?? "-"}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          className="min-h-control rounded-btn px-2 text-xs font-bold text-blue hover:bg-surface"
                          onClick={() => startEditVillage(item)}
                        >
                          Ubah
                        </button>{" "}
                        <button
                          type="button"
                          className="min-h-control rounded-btn px-2 text-xs font-bold text-status-ditolak-fg hover:bg-red-50"
                          onClick={() => removeVillage(item.id)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {villages.length === 0 ? <p className="px-5 py-10 text-center text-sm text-muted">Pilih kecamatan untuk melihat daftar kelurahan.</p> : null}
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
}
