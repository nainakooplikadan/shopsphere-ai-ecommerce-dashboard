import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const REQUEST_LIMIT = 24
const API_URL = `https://dummyjson.com/products?limit=${REQUEST_LIMIT}`
const TIMEOUT_MS = 10000
const TONES = ['sun', 'sky', 'leaf', 'clay', 'night', 'moss', 'rose', 'steel']
const NO_PRODUCTS = []

/* Bundled fictional products. Only shown if the person explicitly chooses offline mode. */
const OFFLINE_PRODUCTS = [
  { id: 101, title: 'Aurora Desk Lamp', price: 49.99, category: 'Home', rating: 4.6, thumbnail: null },
  { id: 102, title: 'Drift Wireless Earbuds', price: 79.0, category: 'Audio', rating: 4.4, thumbnail: null },
  { id: 103, title: 'Summit Trail Bottle', price: 24.5, category: 'Outdoor', rating: 4.8, thumbnail: null },
  { id: 104, title: 'Loom Throw Blanket', price: 38.0, category: 'Home', rating: 4.5, thumbnail: null },
  { id: 105, title: 'Pulse Bookshelf Speaker', price: 129.0, category: 'Audio', rating: 4.2, thumbnail: null },
  { id: 106, title: 'Ridge Day Pack', price: 64.0, category: 'Outdoor', rating: 4.7, thumbnail: null },
  { id: 107, title: 'Meadow Ceramic Planter', price: 22.0, category: 'Home', rating: 4.3, thumbnail: null },
  { id: 108, title: 'Echo Studio Headphones', price: 99.0, category: 'Audio', rating: 4.1, thumbnail: null },
]

const LATER_STAGE_NOTE = 'The cart and Add to cart buttons unlock in a later stage.'

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured (loaded order)' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating-desc', label: 'Rating: high to low' },
]

const INITIAL_STATE = {
  status: 'loading', // loading | success | empty | error
  source: 'live', // live | offline
  products: [],
  skipped: 0,
  total: null,
  message: '',
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const NO_VALUE = '--'

/* ---------- Data validation ---------- */

class LoadError extends Error {}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isText = (v) => typeof v === 'string' && v.trim() !== ''

function safeImageUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function normalizeProduct(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { id, title, price, category, rating, thumbnail } = raw
  if (!isNum(id) || !isText(title) || !isNum(price) || price < 0) return null
  if (!isText(category) || !isNum(rating) || typeof thumbnail !== 'string') return null
  return {
    id,
    title: title.trim(),
    price,
    category: category.trim(),
    rating,
    thumbnail: safeImageUrl(thumbnail),
  }
}

function parseProducts(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
    throw new LoadError('The response did not include a products list.')
  }
  const seen = new Set()
  const products = []
  for (const raw of data.products) {
    const product = normalizeProduct(raw)
    if (product && !seen.has(product.id)) {
      seen.add(product.id)
      products.push(product)
    }
  }
  if (data.products.length > 0 && products.length === 0) {
    throw new LoadError('None of the returned products had the expected format.')
  }
  return {
    products,
    skipped: data.products.length - products.length,
    total: isNum(data.total) ? data.total : null,
  }
}

/* ---------- Discovery helpers ---------- */

const toCents = (p) => Math.round(p.price * 100)

function formatCategory(category) {
  const text = category.replace(/-/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function getCategories(products) {
  return [...new Set(products.map((p) => p.category))].sort((a, b) => a.localeCompare(b))
}

/* Query AND category, then sort. filter() returns a new array, so the source list is never mutated.
   Every sort breaks ties by id so the order is always predictable. */
function filterAndSort(products, query, category, sort) {
  const needle = query.trim().toLowerCase()
  const result = products.filter(
    (p) =>
      (needle === '' || p.title.toLowerCase().includes(needle)) &&
      (category === '' || p.category === category),
  )
  if (sort === 'price-asc') result.sort((a, b) => toCents(a) - toCents(b) || a.id - b.id)
  else if (sort === 'price-desc') result.sort((a, b) => toCents(b) - toCents(a) || a.id - b.id)
  else if (sort === 'rating-desc') result.sort((a, b) => b.rating - a.rating || a.id - b.id)
  return result
}

/* Math runs on integer cents and rating tenths to avoid float drift. */
function summarize(list) {
  const count = list.length
  if (count === 0) return { count, avgPrice: NO_VALUE, avgRating: NO_VALUE }
  const cents = list.reduce((sum, p) => sum + toCents(p), 0)
  const tenths = list.reduce((sum, p) => sum + Math.round(p.rating * 10), 0)
  const hundredths = Math.round((tenths * 10) / count)
  return {
    count,
    avgPrice: usd.format(Math.round(cents / count) / 100),
    avgRating: `${Math.floor(hundredths / 100)}.${String(hundredths % 100).padStart(2, '0')}`,
  }
}

/* ---------- Components ---------- */

function sourceBadge(status, source) {
  if (status === 'success' && source === 'live') return { text: 'Live data', cls: 'badge--live' }
  if (status === 'success') return { text: 'Offline sample data', cls: 'badge--mock' }
  if (status === 'loading') return { text: 'Loading live data…', cls: 'badge--status' }
  if (status === 'empty') return { text: 'No data returned', cls: 'badge--status' }
  return { text: 'Data unavailable', cls: 'badge--status' }
}

function Header({ status, source }) {
  const badge = sourceBadge(status, source)
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__logo" aria-hidden="true" />
        <div>
          <h1 className="brand__name">ShopSphere</h1>
          <p className="brand__tag">Everyday finds, one orbit away</p>
        </div>
      </div>
      <div className="topbar__badges">
        <span className={`badge ${badge.cls}`}>{badge.text}</span>
        <span className="badge">Demo prices shown in USD</span>
      </div>
      <button type="button" className="cart-btn" disabled aria-describedby="later-note">
        Cart (0)
      </button>
    </header>
  )
}

function Controls({
  enabled, loadedCount, query, onQuery, category, categories, onCategory,
  sort, onSort, canClear, onClear,
}) {
  const scope = enabled
    ? `Search and filters only look through the ${loadedCount} products already loaded on this page, not the full API catalog.`
    : 'Search, category, and sort unlock once products are loaded.'
  return (
    <section className="controls" aria-label="Discovery tools">
      <div className="field field--grow">
        <label htmlFor="search">Search loaded products by title</label>
        <input
          id="search"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Type part of a title"
          autoComplete="off"
          disabled={!enabled}
          aria-describedby="scope-note"
        />
      </div>
      <div className="field">
        <label htmlFor="category">Category (loaded products)</label>
        <select
          id="category"
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          disabled={!enabled}
          aria-describedby="scope-note"
        >
          <option value="">All loaded categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{formatCategory(c)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sort">Sort by</label>
        <select
          id="sort"
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          disabled={!enabled}
          aria-describedby="scope-note"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <button type="button" className="btn btn--ghost controls__clear" onClick={onClear}
        disabled={!enabled || !canClear}>
        Clear filters
      </button>
      <p id="scope-note" className="controls__note">{scope}</p>
      <p id="later-note" className="controls__note">{LATER_STAGE_NOTE}</p>
    </section>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Rating({ value }) {
  const filled = Math.min(5, Math.max(0, Math.round(value)))
  return (
    <span className="rating" role="img" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="rating__stars" aria-hidden="true">
        {'★'.repeat(filled)}
        <span className="rating__off">{'★'.repeat(5 - filled)}</span>
      </span>
      <span className="rating__num" aria-hidden="true">{value.toFixed(1)}</span>
    </span>
  )
}

function Thumbnail({ src, title, id }) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed
  const tone = TONES[Math.abs(Math.trunc(id)) % TONES.length]
  return (
    <div className={`thumb ${showImage ? 'thumb--photo' : `thumb--${tone}`}`}>
      {showImage ? (
        <img
          className="thumb__img"
          src={src}
          alt={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="thumb__glyph" role="img" aria-label={`Image unavailable for ${title}`}>
          {title.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

function ProductCard({ product }) {
  const { id, title, price, category, rating, thumbnail } = product
  return (
    <article className="card" aria-labelledby={`title-${id}`}>
      <Thumbnail src={thumbnail} title={title} id={id} />
      <div className="card__body">
        <p className="card__meta">
          <span className="chip">{formatCategory(category)}</span>
          <span className="card__id">ID {id}</span>
        </p>
        <h3 id={`title-${id}`} className="card__title">{title}</h3>
        <Rating value={rating} />
        <p className="card__price">{usd.format(price)}</p>
        <button type="button" className="add-btn" disabled aria-describedby="later-note">
          Add to cart
        </button>
      </div>
    </article>
  )
}

function SkeletonGrid() {
  return (
    <>
      <p className="loading-text">Loading products… this stops after 10 seconds if the service is slow.</p>
      <div className="grid" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card card--skeleton" />
        ))}
      </div>
    </>
  )
}

function StatePanel({ kind, message, onRetry, onOffline }) {
  const isError = kind === 'error'
  return (
    <div className={`state-panel${isError ? ' state-panel--error' : ''}`} role={isError ? 'alert' : 'status'}>
      <h3 className="state-panel__title">
        {isError ? 'We couldn’t load products' : 'No products returned'}
      </h3>
      <p>{message}</p>
      <p className="state-panel__hint">
        Try again, or continue with 8 fictional offline sample products. Offline data is not live.
      </p>
      <div className="state-panel__actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>Retry</button>
        <button type="button" className="btn btn--ghost" onClick={onOffline}>
          Use offline sample data
        </button>
      </div>
    </div>
  )
}

function NoMatchPanel({ loadedCount, onClear }) {
  return (
    <div className="state-panel" role="status">
      <h3 className="state-panel__title">No loaded products match</h3>
      <p>
        None of the {loadedCount} loaded products match your search and filters. Search only covers the
        products already loaded, not the full catalog.
      </p>
      <div className="state-panel__actions">
        <button type="button" className="btn btn--primary" onClick={onClear}>
          Clear filters
        </button>
      </div>
    </div>
  )
}

function DataNotice({ state }) {
  if (state.status !== 'success') return null
  const n = state.products.length
  if (state.source === 'offline') {
    return (
      <p className="data-notice">
        <strong>Offline sample data, not live.</strong> {n} fictional products bundled with the app.
        Prices are demo values shown in USD.{' '}
        <button type="button" className="link-btn" onClick={state.onTryLive}>Try live data again</button>
      </p>
    )
  }
  return (
    <p className="data-notice">
      <strong>Live data</strong> from the DummyJSON public demo API. Prices are demo values shown in USD.
      Loaded subset: {n} products{state.total !== null ? ` of ${state.total} in the catalog` : ''} (up to{' '}
      {REQUEST_LIMIT} requested), not the full catalog.
      {state.skipped > 0 ? ` ${state.skipped} item(s) were skipped because of unexpected data.` : ''}
    </p>
  )
}

export default function App() {
  const [state, setState] = useState(INITIAL_STATE)
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('featured')
  const inFlight = useRef(false)
  const productsRef = useRef(null)

  useEffect(() => {
    let active = true // false after cleanup: ignore any late result
    let timedOut = false
    const controller = new AbortController()
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, TIMEOUT_MS)
    inFlight.current = true

    async function load() {
      try {
        const res = await fetch(API_URL, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) throw new LoadError(`The server responded with status ${res.status}.`)
        let data
        try {
          data = await res.json()
        } catch (err) {
          if (err.name === 'AbortError') throw err
          throw new LoadError('The response was not valid JSON.')
        }
        const { products, skipped, total } = parseProducts(data)
        if (!active) return
        setState({
          status: products.length === 0 ? 'empty' : 'success',
          source: 'live',
          products,
          skipped,
          total,
          message: products.length === 0 ? 'The service responded, but the product list was empty.' : '',
        })
      } catch (err) {
        if (!active) return
        let message
        if (err.name === 'AbortError') {
          message = timedOut
            ? 'The request timed out after 10 seconds.'
            : 'The request was cancelled before it finished.'
        } else if (err instanceof LoadError) {
          message = err.message
        } else {
          message = 'Could not reach the product service. Check your internet connection.'
        }
        setState({ ...INITIAL_STATE, status: 'error', message })
      } finally {
        clearTimeout(timer)
        if (active) inFlight.current = false
      }
    }

    load()
    return () => {
      active = false
      clearTimeout(timer)
      controller.abort()
      inFlight.current = false
    }
  }, [attempt])

  const clearFilters = useCallback(() => {
    setQuery('')
    setCategory('')
    setSort('featured')
  }, [])

  const retry = useCallback(() => {
    if (inFlight.current) return // guard overlapping attempts
    clearFilters()
    setState(INITIAL_STATE)
    setAttempt((a) => a + 1)
    productsRef.current?.focus()
  }, [clearFilters])

  const chooseOffline = useCallback(() => {
    if (inFlight.current) return
    clearFilters()
    setState({ ...INITIAL_STATE, status: 'success', source: 'offline', products: OFFLINE_PRODUCTS })
    productsRef.current?.focus()
  }, [clearFilters])

  const ready = state.status === 'success'
  const loaded = ready ? state.products : NO_PRODUCTS
  const categories = useMemo(() => getCategories(loaded), [loaded])
  const activeCategory = categories.includes(category) ? category : ''
  const visible = useMemo(
    () => filterAndSort(loaded, query, activeCategory, sort),
    [loaded, query, activeCategory, sort],
  )
  const canClear = query !== '' || activeCategory !== '' || sort !== 'featured'
  const { count, avgPrice, avgRating } = summarize(visible)

  return (
    <div className="app">
      <a className="skip-link" href="#products">Skip to products</a>
      <Header status={state.status} source={state.source} />
      <main className="page">
        <Controls
          enabled={ready}
          loadedCount={loaded.length}
          query={query}
          onQuery={setQuery}
          category={activeCategory}
          categories={categories}
          onCategory={setCategory}
          sort={sort}
          onSort={setSort}
          canClear={canClear}
          onClear={clearFilters}
        />

        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="section-title">Catalog summary</h2>
          <dl className="summary">
            <SummaryCard label="Visible products" value={ready ? count : NO_VALUE} />
            <SummaryCard label="Average displayed price" value={ready ? avgPrice : NO_VALUE} />
            <SummaryCard
              label="Average displayed rating"
              value={ready && count > 0 ? `${avgRating} / 5` : NO_VALUE}
            />
          </dl>
        </section>

        <section id="products" ref={productsRef} tabIndex={-1} aria-labelledby="products-heading">
          <h2 id="products-heading" className="section-title">Featured products</h2>
          <div aria-live="polite" aria-busy={state.status === 'loading'}>
            <DataNotice state={{ ...state, onTryLive: retry }} />
            {ready && (
              <p className="result-count">
                Showing {visible.length} of {loaded.length} loaded products
              </p>
            )}
            {state.status === 'loading' && <SkeletonGrid />}
            {(state.status === 'error' || state.status === 'empty') && (
              <StatePanel
                kind={state.status}
                message={state.message}
                onRetry={retry}
                onOffline={chooseOffline}
              />
            )}
            {ready && visible.length === 0 && (
              <NoMatchPanel loadedCount={loaded.length} onClear={clearFilters} />
            )}
            {ready && visible.length > 0 && (
              <div className="grid">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <footer className="footer">
        ShopSphere is a fictional demo. Product data comes from DummyJSON’s public demo API, prices are demo
        values in USD, and there is no checkout.
      </footer>
    </div>
  )
}