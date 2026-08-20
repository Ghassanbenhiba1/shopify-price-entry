import { useCallback, useRef, useState } from 'react'

export default function Dropzone({ onFile, loading, errorMsg, apiEnabled }) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = useCallback(
    (files) => {
      const file = files && files[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.csv')) {
        alert('Merci de sélectionner un fichier .csv')
        return
      }
      onFile(file)
    },
    [onFile]
  )

  return (
    <div className="dropzone-screen">
      <div className="dropzone-screen__inner">
        <h1 className="dropzone-screen__heading">Saisie des prix Shopify</h1>
        <p className="dropzone-screen__lead">
          Importez votre export CSV Shopify, saisissez les prix produit par produit, puis
          exportez un fichier prêt à réimporter dans Shopify.
          {apiEnabled && ' Le fichier importé ici remplace le catalogue partagé pour tous les visiteurs.'}
        </p>
        <div
          className={`dropzone ${dragOver ? 'dropzone--over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            handleFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          {loading ? (
            <p>{apiEnabled ? 'Envoi du fichier au serveur…' : 'Lecture du fichier en cours…'}</p>
          ) : (
            <>
              <p className="dropzone__icon" aria-hidden="true">📄</p>
              <p className="dropzone__title">Glissez-déposez votre fichier products_export.csv</p>
              <p className="dropzone__subtitle">ou cliquez ici pour parcourir vos fichiers</p>
            </>
          )}
        </div>
        {errorMsg && <p className="error-message">{errorMsg}</p>}
        <p className="privacy-note">
          {apiEnabled
            ? '🔄 Ce fichier sera envoyé au serveur partagé et visible par tous les visiteurs, sur tous les appareils.'
            : "🔒 100 % local — votre fichier est lu et traité entièrement dans votre navigateur. Aucune donnée n'est envoyée à un serveur."}
        </p>
      </div>
    </div>
  )
}
