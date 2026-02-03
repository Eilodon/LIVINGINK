import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { LevelList } from './components/LevelList'
import { PropertyEditor } from './components/PropertyEditor'
import { VisualPreview } from './components/VisualPreview'
import { useWebSocket } from './hooks/useWebSocket'
import { type LevelConfig } from './types'

const API_URL = 'http://localhost:8090/api'

function App() {
  const [levels, setLevels] = useState<LevelConfig[]>([])
  const [selectedLevel, setSelectedLevel] = useState<LevelConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket('ws://localhost:8091')

  // Initial load
  useEffect(() => {
    fetchLevels()
  }, [])

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data)
      if (data.type === 'LEVEL_UPDATED') {
        // Update the level in our list
        setLevels(prev => prev.map(l => l.id === data.levelId ? data.level : l))
        // Update selected level if it's the one that changed
        if (selectedLevel?.id === data.levelId) {
          setSelectedLevel(data.level)
        }
      } else if (data.type === 'INITIAL_STATE') {
        setLevels(data.levels)
      }
    }
  }, [lastMessage, selectedLevel])

  const fetchLevels = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/levels`)
      const data = await response.json()
      setLevels(data)
    } catch (error) {
      console.error('Failed to load levels:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveLevel = useCallback(async (level: LevelConfig) => {
    setSaveStatus('saving')
    try {
      const response = await fetch(`${API_URL}/levels/${level.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(level)
      })
      
      if (response.ok) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Failed to save level:', error)
      setSaveStatus('error')
    }
  }, [])

  const handleExport = async () => {
    try {
      const response = await fetch(`${API_URL}/levels/export`, { method: 'POST' })
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `levels_export_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export levels:', error)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎮 Color Jelly Rush - Level Editor</h1>
        <div className="header-actions">
          <span className={`save-status ${saveStatus}`}>
            {saveStatus === 'saving' && '💾 Saving...'}
            {saveStatus === 'saved' && '✅ Saved!'}
            {saveStatus === 'error' && '❌ Error'}
          </span>
          <button onClick={handleExport} className="btn-export">
            📥 Export All
          </button>
        </div>
      </header>

      <main className="app-main">
        {isLoading ? (
          <div className="loading">Loading levels...</div>
        ) : (
          <>
            <LevelList 
              levels={levels} 
              selectedId={selectedLevel?.id}
              onSelect={setSelectedLevel}
            />
            <PropertyEditor 
              level={selectedLevel}
              onChange={handleSaveLevel}
            />
            <VisualPreview level={selectedLevel} />
          </>
        )}
      </main>
    </div>
  )
}

export default App
