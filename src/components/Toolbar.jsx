const FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'noImage', label: 'Sans image' },
  { value: 'removed', label: 'À enlever' },
  { value: 'confirmed', label: 'Confirmé' },
]

export default function Toolbar({
  fileName,
  syncEnabled,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  totalCount,
  noImageCount,
  removedCount,
  confirmedCount,
  onExport,
  onChangeFile,
  onClearStorage,
}) {
  const counts = { all: totalCount, noImage: noImageCount, removed: removedCount, confirmed: confirmedCount }

  return (
    <header className="toolbar">
      <div className="toolbar__top">
        <div className="toolbar__file" title={fileName}>
          <span className="toolbar__file-icon" aria-hidden="true">📄</span>
          <strong>{fileName}</strong>
          <span
            className={`sync-badge ${syncEnabled ? 'sync-badge--on' : 'sync-badge--off'}`}
            title={
              syncEnabled
                ? 'Les prix sont synchronisés en temps réel entre tous les appareils.'
                : "Synchronisation désactivée (Firebase non configuré) : les prix restent locaux à cet appareil."
            }
          >
            {syncEnabled ? '🔄 Synchronisé' : '⚠️ Local uniquement'}
          </span>
        </div>
        <div className="toolbar__actions">
          <input
            type="search"
            className="toolbar__search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button className="btn btn--ghost" onClick={onChangeFile}>
            Changer de fichier
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              if (confirm('Effacer toute la progression sauvegardée pour ce fichier ? Cette action est irréversible.')) {
                onClearStorage()
              }
            }}
          >
            Effacer les données
          </button>
          <button className="btn btn--primary" onClick={onExport}>
            Exporter le CSV mis à jour
          </button>
        </div>
      </div>
      <div className="toolbar__filters" role="tablist" aria-label="Filtrer les produits">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`filter-chip ${filter === f.value ? 'filter-chip--active' : ''}`}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
            <span className="filter-chip__count">{counts[f.value]}</span>
          </button>
        ))}
      </div>
    </header>
  )
}
