import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// Query Cache — module-level Map agar persisten sepanjang sesi browser.
// Key  : JSON.stringify(params)
// Value: { data, pagination, timestamp }
// ---------------------------------------------------------------------------
const queryCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 menit dalam milidetik

// ---------------------------------------------------------------------------
// useGuns — fetch the paginated / filtered product list from the API.
//
// Fitur Query Caching:
//   Sebelum request ke API, hook mengecek apakah hasil query yang sama
//   sudah ada di cache dan belum kedaluwarsa (< 5 menit). Jika ada,
//   data langsung dipakai dari cache tanpa hit network.
//
//   Fungsi refetch() menghapus entry cache terlebih dahulu sehingga
//   data selalu fresh setelah operasi CRUD (create / update / delete).
//
// Returns { guns, loading, error, pagination, refetch }.
// ---------------------------------------------------------------------------

export function useGuns(params = {}) {
  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  // Serialise params sebagai cache key dan effect dependency.
  const paramKey = JSON.stringify(params)

  const fetchGuns = useCallback(async () => {
    // ---- Cek cache ----
    const cached = queryCache.get(paramKey)
    const now = Date.now()

    if (cached && now - cached.timestamp < CACHE_TTL) {
      // Cache hit: data masih segar, tidak perlu request API
      setGuns(cached.data)
      setPagination(cached.pagination)
      setLoading(false)
      setError(null)
      return
    }

    // ---- Cache miss atau kedaluwarsa: fetch dari API ----
    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGuns(params)

      if (response.success) {
        const data = response.data || []
        const pag = response.pagination || null

        setGuns(data)
        setPagination(pag)

        // Simpan hasil ke cache
        queryCache.set(paramKey, {
          data,
          pagination: pag,
          timestamp: Date.now(),
        })
      } else {
        setError(response.message || 'Failed to fetch products.')
      }
    } catch (err) {
      setError(err.message || 'An error occurred while fetching products.')
      setGuns([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey])

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  // refetch paksa — hapus cache entry lalu fetch ulang.
  // Dipanggil setelah operasi CRUD agar data selalu fresh.
  const refetch = useCallback(() => {
    queryCache.delete(paramKey)
    fetchGuns()
  }, [paramKey, fetchGuns])

  return { guns, loading, error, pagination, refetch }
}

// ---------------------------------------------------------------------------
// useGunById — fetch a single product by its UUID.
//
// Returns { gun, loading, error, refetch }.
// ---------------------------------------------------------------------------

export function useGunById(id) {
  const [gun, setGun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchGun = useCallback(async () => {
    if (!id) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)

      const response = await gunService.getGunById(id)

      if (response.success) {
        setGun(response.data)
      } else {
        setError(response.message || 'Product not found.')
      }
    } catch (err) {
      setError(err.message || 'Failed to load product details.')
      setGun(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchGun()
  }, [fetchGun])

  return { gun, loading, error, refetch: fetchGun }
}
