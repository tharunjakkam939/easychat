import { useState, useEffect, useRef } from "react"
import ReactMarkdown from 'react-markdown'

const API = "http://localhost:8000"
const GOOGLE_CLIENT_ID = "300153847360-psaml0jkprcp3q17mfb3hg7dinmefdek.apps.googleusercontent.com"

export default function App() {
  const [screen, setScreen] = useState("login")
  const [token, setToken] = useState(null)
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [error, setError] = useState("")
  const [conversations, setConversations] = useState([])
  const [filteredConvs, setFilteredConvs] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeConvId, setActiveConvId] = useState(null)
  const [messages, setMessages] = useState([])
  const [convDocs, setConvDocs] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [uploadStatus, setUploadStatus] = useState("")
  const [pendingFile, setPendingFile] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [editUsername, setEditUsername] = useState("")
  const [copiedId, setCopiedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState("")
  const [shareUrl, setShareUrl] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const fileRef = useRef()
  const messagesEndRef = useRef()
  const attachMenuRef = useRef()
  const activeConvIdRef = useRef(null)

  useEffect(() => { activeConvIdRef.current = activeConvId }, [activeConvId])

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  useEffect(() => {
    if (token) { loadConversations(); loadMe() }
  }, [token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!searchQuery.trim()) setFilteredConvs(conversations)
    else setFilteredConvs(conversations.filter(c =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    ))
  }, [searchQuery, conversations])

  useEffect(() => {
    function handleClick(e) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target))
        setShowAttachMenu(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  async function loadMe() {
    const res = await fetch(`${API}/me`, { headers: { "Authorization": `Bearer ${token}` } })
    const data = await res.json()
    if (data.username) { setUsername(data.username); setEditUsername(data.username) }
    if (data.email) setEmail(data.email)
  }

  async function loadConversations() {
    const res = await fetch(`${API}/conversations`, { headers: { "Authorization": `Bearer ${token}` } })
    const data = await res.json()
    setConversations(data); setFilteredConvs(data)
  }

  async function loadMessages(convId) {
    const res = await fetch(`${API}/conversations/${convId}/messages`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
    const data = await res.json()
    const msgs = (data.messages || []).map(m => ({
      sender: m.role === "user" ? "user" : "ai",
      text: m.content
    }))
    setMessages(msgs)
    setConvDocs(data.documents || [])
    setActiveConvId(convId)
  }

  function startNewChat() {
    setActiveConvId(null); setMessages([])
    setConvDocs([]); setSearchQuery("")
    setPendingFile(null); setShareUrl(null)
  }

  function confirmDelete(convId, e) {
    e.stopPropagation(); setDeleteConfirm(convId)
  }

  async function doDelete(convId) {
    await fetch(`${API}/conversations/${convId}`, {
      method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
    })
    if (activeConvId === convId) startNewChat()
    setDeleteConfirm(null); loadConversations()
  }

  async function handleLogin() {
    setError("")
    const form = new URLSearchParams()
    form.append("username", email); form.append("password", password)
    const res = await fetch(`${API}/login`, { method: "POST", body: form })
    const data = await res.json()
    if (!res.ok) return setError(data.detail)
    setToken(data.access_token); setScreen("chat")
  }

  async function handleRegister() {
    setError("")
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username: regUsername || email.split("@")[0] })
    })
    const data = await res.json()
    if (!res.ok) return setError(data.detail)
    setScreen("login"); setError("Registered! Please log in.")
  }

  async function handleGoogleLogin(googleToken) {
    const res = await fetch(`${API}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: googleToken })
    })
    const data = await res.json()
    if (!res.ok) return setError("Google login failed")
    setToken(data.access_token); setEmail(data.email)
    setUsername(data.username || data.email.split("@")[0]); setScreen("chat")
  }

  function initGoogleSignIn() {
    if (!window.google) { setError("Google not loaded. Try again."); return }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => handleGoogleLogin(response.credential)
    })
    window.google.accounts.id.prompt()
  }

  async function saveUsername() {
    const res = await fetch(`${API}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ username: editUsername })
    })
    if (res.ok) { setUsername(editUsername); setShowProfile(false) }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    setPendingFile(file); setShowAttachMenu(false)
    fileRef.current.value = ""
  }

  function openShare() {
    if (!activeConvId) return
    const url = `${API}/share/${activeConvId}`
    setShareUrl(url)
    setLinkCopied(false)
  }

  function copyShareLink() {
    navigator.clipboard.writeText(shareUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function sendMessage(overrideText) {
    const textToSend = overrideText !== undefined ? overrideText : input
    if ((!textToSend?.trim() && !pendingFile) || loading) return

    const currentFile = pendingFile
    setPendingFile(null)
    if (overrideText === undefined) setInput("")
    setLoading(true)

    if (currentFile) {
      const fileMsg = {
        sender: "user",
        text: textToSend || `Tell me about this file`,
        file: { name: currentFile.name, size: currentFile.size }
      }
      setMessages(prev => [...prev, fileMsg, { sender: "ai", text: "", streaming: true }])
      setUploadStatus(`Uploading ${currentFile.name}...`)

      const form = new FormData()
      form.append("file", currentFile)
      if (activeConvId) form.append("conversation_id", String(activeConvId))
      if (textToSend?.trim()) form.append("message", textToSend)

      const res = await fetch(`${API}/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: form
      })
      const data = await res.json()
      setUploadStatus("")

      if (res.ok) {
        if (!activeConvId) setActiveConvId(data.conversation_id)
        setConvDocs(prev => prev.includes(data.filename) ? prev : [...prev, data.filename])
        loadConversations()
        const replyText = data.ai_reply || `✓ **${data.filename}** uploaded! Ask me anything about it.`
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.streaming ? { ...m, text: replyText, streaming: false } : m
        ))
      } else {
        setMessages(prev => prev.map((m, i) =>
          i === prev.length - 1 && m.streaming
            ? { ...m, text: "Upload failed: " + (data.detail || "error"), streaming: false } : m
        ))
      }
      setLoading(false)
      return
    }

    setMessages(prev => [
      ...prev,
      { sender: "user", text: textToSend },
      { sender: "ai", text: "", streaming: true }
    ])

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message: textToSend, conversation_id: activeConvIdRef.current })
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop()

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const parsed = JSON.parse(line.slice(6))
            if (parsed.type === "meta") {
              if (!activeConvIdRef.current) {
                setActiveConvId(parsed.conversation_id)
                activeConvIdRef.current = parsed.conversation_id
              }
            } else if (parsed.type === "token") {
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 && m.streaming
                  ? { ...m, text: m.text + parsed.token } : m
              ))
            } else if (parsed.type === "title_update") {
              const newTitle = parsed.title
              setConversations(prev => prev.map(c =>
                c.id === activeConvIdRef.current ? { ...c, title: newTitle } : c
              ))
              setFilteredConvs(prev => prev.map(c =>
                c.id === activeConvIdRef.current ? { ...c, title: newTitle } : c
              ))
              loadConversations()
            } else if (parsed.type === "done") {
              setMessages(prev => prev.map((m, i) =>
                i === prev.length - 1 && m.streaming ? { ...m, streaming: false } : m
              ))
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => prev.map((m, i) =>
        i === prev.length - 1 && m.streaming
          ? { ...m, text: "Connection error!", streaming: false } : m
      ))
    }
    setLoading(false)
  }

  async function saveEditAndResend(i) {
    const newText = editText
    setEditingId(null)
    setMessages(prev => prev.slice(0, i))
    await new Promise(r => setTimeout(r, 50))
    await sendMessage(newText)
  }

  function copyMessage(text, id) {
    navigator.clipboard.writeText(text)
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000)
  }

  function downloadMessage(text, id) {
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `message-${id}.txt`
    a.click(); URL.revokeObjectURL(url)
  }

  function downloadChat() {
    const text = messages.map(m =>
      `${m.sender === "user" ? "You" : "EasyChat"}: ${m.text}`
    ).join("\n\n---\n\n")
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `easychat-conversation.txt`
    a.click(); URL.revokeObjectURL(url)
  }

  const avatarLetter = username ? username[0].toUpperCase() : email ? email[0].toUpperCase() : "U"
  const displayName = username || email.split("@")[0]

  if (screen === "login" || screen === "register") {
    return (
      <div style={s.authShell}>
        <div style={s.authBox}>
          <div style={s.authLogo}>EC</div>
          <h2 style={s.authTitle}>EasyChat</h2>
          <p style={s.authSub}>{screen === "login" ? "Welcome back" : "Create your account"}</p>
          {error && <p style={s.authError}>{error}</p>}
          <button style={s.googleBtn} onClick={initGoogleSignIn}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
          <div style={s.divider}>
            <div style={s.dividerLine}/><span style={s.dividerText}>or</span><div style={s.dividerLine}/>
          </div>
          {screen === "register" && (
            <input style={s.authInput} placeholder="Your name" value={regUsername}
              onChange={e => setRegUsername(e.target.value)} />
          )}
          <input style={s.authInput} placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)} />
          <input style={s.authInput} placeholder="Password" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (screen === "login" ? handleLogin() : handleRegister())}
          />
          <button style={s.authBtn} onClick={screen === "login" ? handleLogin : handleRegister}>
            {screen === "login" ? "Sign in" : "Create account"}
          </button>
          <p style={s.authSwitch}>
            {screen === "login" ? "Don't have an account? " : "Already have an account? "}
            <span style={s.authLink} onClick={() => { setScreen(screen === "login" ? "register" : "login"); setError("") }}>
              {screen === "login" ? "Sign up" : "Sign in"}
            </span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={s.shell}>

      {/* Delete modal */}
      {deleteConfirm && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <p style={s.modalTitle}>Delete conversation?</p>
            <p style={s.modalSub}>This cannot be undone.</p>
            <div style={s.modalBtns}>
              <button style={s.modalCancel} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={s.modalDelete} onClick={() => doDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareUrl && (
        <div style={s.modalOverlay} onClick={() => setShareUrl(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={s.modalTitle}>Share this chat</p>
            <p style={s.modalSub}>Anyone with this link can view the full conversation.</p>
            <div style={s.shareUrlBox}>
              <span style={{ color: "#7B72E9", fontSize: "12px", wordBreak: "break-all", lineHeight: 1.5 }}>{shareUrl}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <button style={{ ...s.authBtn, flex: 1, padding: "10px", fontSize: "13px" }}
                onClick={copyShareLink}>
                {linkCopied ? "✓ Copied!" : "📋 Copy link"}
              </button>
              <button style={{ ...s.authBtn, flex: 1, padding: "10px", fontSize: "13px", background: "#1a1a2e", border: "1px solid #534AB7" }}
                onClick={() => window.open(shareUrl, "_blank")}>
                Open ↗
              </button>
            </div>
            <button style={{ ...s.modalCancel, width: "100%", marginTop: "8px", textAlign: "center" }}
              onClick={() => setShareUrl(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfile && (
        <div style={s.modalOverlay} onClick={() => setShowProfile(false)}>
          <div style={s.profileModal} onClick={e => e.stopPropagation()}>
            <div style={s.profileAvatar}>{avatarLetter}</div>
            <p style={s.profileEmail}>{email}</p>
            <div style={s.profileStats}>
              <div style={s.profileStat}>
                <span style={s.profileStatNum}>{conversations.length}</span>
                <span style={s.profileStatLabel}>Chats</span>
              </div>
            </div>
            <div style={{ width: "100%" }}>
              <p style={{ color: "#555", fontSize: "12px", margin: "0 0 6px" }}>Display name</p>
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={{ ...s.authInput, flex: 1, padding: "8px 12px", fontSize: "13px" }}
                  value={editUsername} onChange={e => setEditUsername(e.target.value)} />
                <button style={{ ...s.authBtn, padding: "8px 14px", fontSize: "13px" }} onClick={saveUsername}>Save</button>
              </div>
            </div>
            <button style={s.profileLogout} onClick={() => {
              setToken(null); setScreen("login"); setShowProfile(false)
              setConversations([]); setMessages([]); setActiveConvId(null)
              setConvDocs([]); setUsername(""); setEmail("")
            }}>Sign out</button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarTop}>
          <span style={s.sidebarLogo}>EasyChat</span>
        </div>
        <div style={s.searchBox}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input style={s.searchInput} placeholder="Search chats..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div style={s.newChatRow} onClick={startNewChat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span style={s.newChatLabel}>New chat</span>
        </div>
        <div style={s.convList}>
          {filteredConvs.length === 0 && searchQuery && <p style={s.noConvs}>No chats found</p>}
          {filteredConvs.length === 0 && !searchQuery && <p style={s.noConvs}>No conversations yet</p>}
          {filteredConvs.map(conv => (
            <div key={conv.id} onClick={() => loadMessages(conv.id)}
              style={{ ...s.convItem, background: activeConvId === conv.id ? "#1a1a2e" : "transparent" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={s.convTitle}>{conv.title}</span>
              <button style={s.convDeleteBtn} onClick={e => confirmDelete(conv.id, e)}>✕</button>
            </div>
          ))}
        </div>
        <div style={s.profileSection} onClick={() => setShowProfile(true)}>
          <div style={s.profileAvatarSmall}>{avatarLetter}</div>
          <div style={s.profileInfo}>
            <p style={s.profileName}>{displayName}</p>
            <p style={s.profileEmailSmall}>{email}</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>
      </div>

      {/* Main */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <span style={s.topbarTitle}>EasyChat</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
            {convDocs.length > 0 && (
              <div style={s.docChips}>
                {convDocs.map((doc, i) => (
                  <div key={i} style={s.docChip}>
                    <span>📄</span>
                    <span style={{ fontSize: "11px", color: "#ccc" }}>{doc}</span>
                  </div>
                ))}
              </div>
            )}
            {activeConvId && messages.length > 0 && (
              <>
                <button style={s.topbarBtn} onClick={openShare}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Share
                </button>
                <button style={s.topbarBtn} onClick={downloadChat}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download
                </button>
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.welcomeBox}>
              <div style={s.welcomeIcon}>{avatarLetter}</div>
              <h2 style={s.welcomeTitle}>Hi, {displayName}! 👋</h2>
              <p style={s.welcomeSub}>What would you like to explore today?</p>
              <div style={s.quickBtns}>
                <button style={s.quickBtn} onClick={() => setInput("Explain machine learning simply")}>Explain machine learning</button>
                <button style={s.quickBtn} onClick={() => setInput("Write a Python hello world")}>Write Python code</button>
                <button style={s.quickBtn} onClick={() => setInput("What are REST API best practices?")}>REST API tips</button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ ...s.bubbleRow, justifyContent: msg.sender === "user" ? "flex-end" : "flex-start" }}>
              {msg.sender === "ai" && <div style={s.aiAvatar}>EC</div>}
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: "4px" }}>

                {msg.file && (
                  <div style={s.filePreview}>
                    <span style={{ fontSize: "22px" }}>
                      {msg.file.name.endsWith(".pdf") ? "📄" :
                       msg.file.name.endsWith(".ipynb") ? "📓" :
                       msg.file.name.endsWith(".py") ? "🐍" :
                       msg.file.name.endsWith(".docx") ? "📝" : "📁"}
                    </span>
                    <div>
                      <div style={{ color: "#fff", fontSize: "13px", fontWeight: "500" }}>{msg.file.name}</div>
                      <div style={{ color: "#aaa", fontSize: "11px" }}>{(msg.file.size / 1024).toFixed(1)} KB · Document</div>
                    </div>
                  </div>
                )}

                {(msg.text || msg.streaming) && (
                  <div>
                    {editingId === i ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <textarea style={s.editTextarea} value={editText}
                          onChange={e => setEditText(e.target.value)} rows={3}
                          onKeyDown={e => e.key === "Enter" && !e.shiftKey && saveEditAndResend(i)}
                        />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button style={s.editSaveBtn} onClick={() => saveEditAndResend(i)}>Send ↑</button>
                          <button style={s.editCancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className={msg.sender === "ai" ? "ai-bubble" : ""} style={{
                        ...s.bubble,
                        background: msg.sender === "user" ? "#534AB7" : "#111120",
                        borderRadius: msg.sender === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        border: msg.sender === "ai" ? "1px solid #1e1e30" : "none"
                      }}>
                        <ReactMarkdown>{msg.text || (msg.streaming ? "▍" : "")}</ReactMarkdown>
                      </div>
                    )}

                    {!msg.streaming && msg.text && editingId !== i && (
                      <div style={{ ...s.msgActions, justifyContent: msg.sender === "user" ? "flex-end" : "flex-start" }}>
                        <button style={s.actionBtn} onClick={() => copyMessage(msg.text, i)} title="Copy">
                          {copiedId === i ? "✓" : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                        {msg.sender === "user" && (
                          <button style={s.actionBtn} onClick={() => { setEditingId(i); setEditText(msg.text) }} title="Edit & resend">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                            Edit
                          </button>
                        )}
                        <button style={s.actionBtn} onClick={() => downloadMessage(msg.text, i)} title="Download">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {msg.sender === "user" && <div style={s.userAvatar}>{avatarLetter}</div>}
            </div>
          ))}

          {/* Share button at bottom of chat */}
          {messages.length > 2 && !loading && activeConvId && (
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <button style={s.bottomShareBtn} onClick={openShare}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share this conversation
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {uploadStatus && <div style={s.uploadStatusBar}>{uploadStatus}</div>}

        {/* Input area */}
        <div style={s.inputArea}>
          {pendingFile && (
            <div style={s.pendingFileRow}>
              <div style={s.pendingFileChip}>
                <span style={{ fontSize: "18px" }}>
                  {pendingFile.name.endsWith(".pdf") ? "📄" :
                   pendingFile.name.endsWith(".ipynb") ? "📓" :
                   pendingFile.name.endsWith(".py") ? "🐍" :
                   pendingFile.name.endsWith(".docx") ? "📝" : "📁"}
                </span>
                <div>
                  <div style={{ color: "#fff", fontSize: "12px", fontWeight: "500" }}>{pendingFile.name}</div>
                  <div style={{ color: "#888", fontSize: "11px" }}>{(pendingFile.size / 1024).toFixed(1)} KB</div>
                </div>
                <button style={s.removePendingFile} onClick={() => setPendingFile(null)}>✕</button>
              </div>
            </div>
          )}
          <div style={s.inputBox}>
            <div style={{ position: "relative" }} ref={attachMenuRef}>
              <button style={s.attachBtn} onClick={() => setShowAttachMenu(v => !v)}>+</button>
              {showAttachMenu && (
                <div style={s.attachMenu}>
                  <input type="file"
                    accept=".pdf,.txt,.docx,.py,.ipynb,.md,.csv,.json"
                    ref={fileRef} onChange={handleFileSelect} style={{ display: "none" }} />
                  <div style={s.attachMenuHeader}>Attach a file</div>
                  {[
                    { icon: "📄", title: "PDF Document", sub: ".pdf", accept: ".pdf" },
                    { icon: "📝", title: "Word Document", sub: ".docx", accept: ".docx" },
                    { icon: "🐍", title: "Python / Notebook", sub: ".py .ipynb", accept: ".py,.ipynb" },
                    { icon: "📁", title: "Any supported", sub: "pdf, docx, txt, py, ipynb...", accept: ".pdf,.txt,.docx,.py,.ipynb,.md,.csv,.json" },
                  ].map((item, idx) => (
                    <div key={idx} style={s.attachMenuItem} onClick={() => {
                      fileRef.current.accept = item.accept; fileRef.current.click()
                    }}>
                      <span style={s.attachIcon}>{item.icon}</span>
                      <div>
                        <div style={s.attachItemTitle}>{item.title}</div>
                        <div style={s.attachItemSub}>{item.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <input style={s.input} value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={pendingFile ? `Ask about ${pendingFile.name}...` : "Ask anything..."}
            />
            <button style={{
              ...s.sendBtn,
              background: (input.trim() || pendingFile) && !loading ? "#534AB7" : "#1a1a2e",
              cursor: loading ? "not-allowed" : "pointer"
            }} onClick={() => sendMessage()} disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            </button>
          </div>
          <p style={s.inputHint}>Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

const s = {
  authShell: { display: "flex", height: "100vh", background: "#0a0a14", alignItems: "center", justifyContent: "center" },
  authBox: { background: "#111120", padding: "48px 40px", borderRadius: "20px", width: "380px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid #1e1e30" },
  authLogo: { width: "48px", height: "48px", background: "#534AB7", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "16px", margin: "0 auto" },
  authTitle: { color: "#fff", fontSize: "22px", fontWeight: "700", textAlign: "center", margin: 0 },
  authSub: { color: "#555", textAlign: "center", margin: 0, fontSize: "13px" },
  authError: { color: "#ff6b6b", fontSize: "13px", textAlign: "center", padding: "8px", background: "#2a1515", borderRadius: "8px", margin: 0 },
  googleBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "11px", background: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: "500", color: "#333" },
  divider: { display: "flex", alignItems: "center", gap: "10px" },
  dividerLine: { flex: 1, height: "1px", background: "#1e1e30" },
  dividerText: { color: "#444", fontSize: "12px" },
  authInput: { padding: "11px 14px", borderRadius: "10px", border: "1px solid #1e1e30", background: "#0a0a14", color: "#fff", fontSize: "14px", outline: "none" },
  authBtn: { padding: "12px", background: "#534AB7", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "15px", fontWeight: "600" },
  authSwitch: { color: "#444", fontSize: "13px", textAlign: "center", margin: 0 },
  authLink: { color: "#7B72E9", cursor: "pointer", fontWeight: "500" },
  shell: { display: "flex", height: "100vh", background: "#0a0a14", fontFamily: "'Inter', sans-serif", overflow: "hidden" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#111120", border: "1px solid #1e1e30", borderRadius: "16px", padding: "28px", width: "340px" },
  modalTitle: { color: "#fff", fontWeight: "600", fontSize: "16px", margin: "0 0 6px" },
  modalSub: { color: "#666", fontSize: "13px", margin: "0 0 14px" },
  modalBtns: { display: "flex", gap: "10px" },
  modalCancel: { flex: 1, padding: "10px", background: "transparent", border: "1px solid #2a2a3e", borderRadius: "8px", color: "#aaa", cursor: "pointer", fontSize: "14px" },
  modalDelete: { flex: 1, padding: "10px", background: "#8B2020", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontSize: "14px" },
  shareUrlBox: { background: "#0a0a14", border: "1px solid #1e1e30", borderRadius: "8px", padding: "10px 12px" },
  profileModal: { background: "#111120", border: "1px solid #1e1e30", borderRadius: "20px", padding: "32px 28px", width: "340px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" },
  profileAvatar: { width: "64px", height: "64px", background: "#534AB7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "24px" },
  profileEmail: { color: "#888", fontSize: "13px", margin: 0 },
  profileStats: { display: "flex", gap: "32px", margin: "4px 0" },
  profileStat: { display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" },
  profileStatNum: { color: "#fff", fontWeight: "700", fontSize: "22px" },
  profileStatLabel: { color: "#555", fontSize: "11px" },
  profileLogout: { padding: "10px 24px", background: "transparent", border: "1px solid #2a2a3e", borderRadius: "10px", color: "#888", cursor: "pointer", fontSize: "14px" },
  sidebar: { width: "260px", background: "#0d0d1a", borderRight: "1px solid #1a1a2e", display: "flex", flexDirection: "column", flexShrink: 0 },
  sidebarTop: { padding: "16px", display: "flex", alignItems: "center" },
  sidebarLogo: { color: "#fff", fontWeight: "700", fontSize: "16px" },
  searchBox: { margin: "0 10px 8px", display: "flex", alignItems: "center", gap: "8px", background: "#111120", border: "1px solid #1e1e30", borderRadius: "10px", padding: "8px 12px" },
  searchInput: { flex: 1, background: "transparent", border: "none", color: "#ccc", fontSize: "13px", outline: "none" },
  newChatRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px", cursor: "pointer", color: "#888", fontSize: "13px", borderRadius: "8px", margin: "0 6px 4px" },
  newChatLabel: { fontSize: "13px", color: "#888" },
  convList: { flex: 1, overflowY: "auto", padding: "0 6px" },
  noConvs: { color: "#333", fontSize: "12px", textAlign: "center", padding: "20px 0" },
  convItem: { padding: "8px 10px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", marginBottom: "1px" },
  convTitle: { color: "#bbb", fontSize: "12px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  convDeleteBtn: { background: "transparent", border: "none", color: "#333", cursor: "pointer", fontSize: "11px", padding: "2px 4px", flexShrink: 0 },
  profileSection: { padding: "12px 14px", borderTop: "1px solid #1a1a2e", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" },
  profileAvatarSmall: { width: "32px", height: "32px", background: "#534AB7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "600", fontSize: "13px", flexShrink: 0 },
  profileInfo: { flex: 1, overflow: "hidden" },
  profileName: { color: "#ccc", fontSize: "13px", fontWeight: "500", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  profileEmailSmall: { color: "#444", fontSize: "10px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  topbar: { padding: "12px 24px", borderBottom: "1px solid #1a1a2e", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 },
  topbarTitle: { color: "#fff", fontWeight: "600", fontSize: "15px" },
  topbarBtn: { display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", background: "transparent", border: "1px solid #1e1e30", borderRadius: "8px", color: "#aaa", cursor: "pointer", fontSize: "12px" },
  docChips: { display: "flex", gap: "6px", flexWrap: "wrap" },
  docChip: { display: "flex", alignItems: "center", gap: "5px", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "20px", padding: "3px 10px" },
  messages: { flex: 1, padding: "24px 24px 12px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" },
  welcomeBox: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: "16px", padding: "40px 0" },
  welcomeIcon: { width: "64px", height: "64px", background: "#534AB7", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "24px" },
  welcomeTitle: { color: "#fff", fontSize: "26px", fontWeight: "700", margin: 0 },
  welcomeSub: { color: "#555", fontSize: "14px", margin: 0 },
  quickBtns: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", maxWidth: "600px" },
  quickBtn: { padding: "10px 16px", background: "#111120", border: "1px solid #1e1e30", borderRadius: "20px", color: "#bbb", cursor: "pointer", fontSize: "13px" },
  bubbleRow: { display: "flex", gap: "10px", alignItems: "flex-start" },
  aiAvatar: { width: "28px", height: "28px", background: "#534AB7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "9px", fontWeight: "700", flexShrink: 0, marginTop: "4px" },
  userAvatar: { width: "28px", height: "28px", background: "#2a2a3e", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "12px", fontWeight: "600", flexShrink: 0, marginTop: "4px" },
  bubble: { padding: "12px 16px", fontSize: "14px", lineHeight: "1.7", color: "#fff" },
  filePreview: { display: "flex", alignItems: "center", gap: "10px", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: "12px", padding: "10px 14px" },
  msgActions: { display: "flex", gap: "4px", marginTop: "4px" },
  actionBtn: { background: "transparent", border: "1px solid #1e1e30", borderRadius: "6px", color: "#666", cursor: "pointer", padding: "3px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" },
  editTextarea: { width: "100%", background: "#1a1a2e", border: "1px solid #534AB7", borderRadius: "10px", color: "#fff", fontSize: "14px", padding: "10px", outline: "none", resize: "vertical", fontFamily: "inherit", minWidth: "280px" },
  editSaveBtn: { padding: "6px 16px", background: "#534AB7", border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: "500" },
  editCancelBtn: { padding: "6px 14px", background: "transparent", border: "1px solid #2a2a3e", borderRadius: "8px", color: "#888", cursor: "pointer", fontSize: "13px" },
  bottomShareBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 20px", background: "transparent", border: "1px solid #1e1e30", borderRadius: "20px", color: "#666", cursor: "pointer", fontSize: "12px" },
  uploadStatusBar: { padding: "6px 24px", background: "#1a1a2e", color: "#7B72E9", fontSize: "12px", flexShrink: 0 },
  inputArea: { padding: "8px 24px 16px", flexShrink: 0 },
  pendingFileRow: { marginBottom: "8px" },
  pendingFileChip: { display: "inline-flex", alignItems: "center", gap: "10px", background: "#1a1a2e", border: "1px solid #534AB7", borderRadius: "12px", padding: "8px 12px" },
  removePendingFile: { background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" },
  inputBox: { display: "flex", alignItems: "center", gap: "8px", background: "#111120", border: "1px solid #1e1e30", borderRadius: "16px", padding: "6px 8px 6px 6px" },
  attachBtn: { width: "34px", height: "34px", borderRadius: "10px", border: "1px solid #1e1e30", background: "transparent", color: "#888", cursor: "pointer", fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  attachMenu: { position: "absolute", bottom: "44px", left: 0, background: "#111120", border: "1px solid #1e1e30", borderRadius: "14px", padding: "8px", width: "220px", zIndex: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" },
  attachMenuHeader: { color: "#555", fontSize: "11px", padding: "4px 10px 8px", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.05em" },
  attachMenuItem: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", color: "#ccc" },
  attachIcon: { fontSize: "18px", flexShrink: 0 },
  attachItemTitle: { fontSize: "13px", color: "#ccc", fontWeight: "500" },
  attachItemSub: { fontSize: "11px", color: "#555", marginTop: "1px" },
  input: { flex: 1, border: "none", background: "transparent", color: "#fff", fontSize: "14px", outline: "none", padding: "6px 4px" },
  sendBtn: { width: "34px", height: "34px", borderRadius: "10px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  inputHint: { color: "#333", fontSize: "11px", textAlign: "center", margin: "6px 0 0" }
}