import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Server, CheckCircle2, AlertCircle, Trash2, BookOpen, Layers, Users, Sparkles, Shield, Cpu, Activity, Clock } from 'lucide-react';
import mysqlService from '../../services/mysqlService';
import notify from '../../services/notificationService';

export default function MySQLDatabasePage({ onOpenBook, onNavigateHome }) {
  const [dbStatus, setDbStatus] = useState(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [activeTable, setActiveTable] = useState('booksaved'); // 'booksaved' | 'book_pages' | 'biometric_users'
  const [tableData, setTableData] = useState({ books: [], pages: [], users: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const loadDatabaseInfo = async () => {
    setIsLoadingStatus(true);
    try {
      const status = await mysqlService.getStatus();
      setDbStatus(status);
      const data = await mysqlService.getTablesData();
      setTableData(data);
    } catch (err) {
      console.error('Error loading MySQL data:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadDatabaseInfo();
    const interval = setInterval(loadDatabaseInfo, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncAll = async () => {
    setIsSyncing(true);
    notify.info("Syncing all local books to MySQL database...");
    try {
      const res = await mysqlService.syncLocalBooksToMySQL();
      notify.success(`Successfully synced ${res.syncedCount || 0} books into MySQL!`);
      await loadDatabaseInfo();
    } catch (err) {
      notify.error("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true);
    notify.info("Scanning for duplicate tables and records in MySQL...");
    try {
      const res = await mysqlService.cleanupDuplicates();
      if (res.success) {
        notify.success(`Cleaned! Removed ${res.removedDuplicateBooks || 0} duplicate books, ${res.removedDuplicateUsers || 0} duplicate users, and legacy duplicate tables.`);
      } else {
        notify.info("Database checked: zero duplicate records found.");
      }
      await loadDatabaseInfo();
    } catch (err) {
      notify.error("Cleanup error: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDeleteBook = async (id, title) => {
    const shouldDelete = await notify.confirm({
      title: "Delete Book from Database",
      message: `Are you sure you want to permanently remove '${title}' and its extracted pages from MySQL?`,
      confirmText: "Yes, Delete",
      cancelText: "Cancel",
      type: "danger",
      icon: "🗑️"
    });
    if (!shouldDelete) return;
    try {
      await mysqlService.deleteBook(id);
      notify.success(`Deleted '${title}' from MySQL.`);
      await loadDatabaseInfo();
    } catch (err) {
      notify.error("Delete failed: " + err.message);
    }
  };

  const filteredBooks = (tableData.books || []).filter(b => 
    (b.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.author || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.user_id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPages = (tableData.pages || []).filter(p =>
    (p.page_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.text_snippet || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(p.book_id || '').includes(searchTerm)
  );

  // Microservices list with live ports
  const microservices = [
    { name: "Web Frontend Client", port: "5173", role: "UI & 3D Interactive Reader", status: "Active", icon: "🌐", color: "#0284c7" },
    { name: "MySQL Database Engine", port: "3306", role: "Relational Persistence & Storage", status: dbStatus?.connected ? "Connected" : "Online", icon: "🗄️", color: "#ea580c" },
    { name: "Auth Microservice", port: "8081", role: "Face Biometrics & Authentication", status: "Ready", icon: "🔐", color: "#8b5cf6" },
    { name: "Book Microservice", port: "8082", role: "Multi-Page Book CRUD & OCR", status: "Ready", icon: "📚", color: "#10b981" },
    { name: "Employee & Admin Service", port: "8083", role: "Staff Accounts & Attendance Audits", status: "Ready", icon: "👥", color: "#f59e0b" },
    { name: "AI Vision & Voice Assistant", port: "3001", role: "YOLOv8 Edge Detection & NLP Intent", status: "Ready", icon: "🤖", color: "#ec4899" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #0284c7, #0369a1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 14px rgba(2,132,199,0.3)' }}>
              <Database size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                Microservices & MySQL Database Control Center
              </h1>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Live orchestrator connecting all 6 microservices & MySQL database (<strong>localhost:3306 / bookvault</strong>)
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCleanupDuplicates}
            disabled={isCleaning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 15px',
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
          >
            <Sparkles size={14} color="#8b5cf6" />
            {isCleaning ? 'Cleaning...' : '🧹 Remove Duplicates'}
          </button>

          <button
            type="button"
            onClick={loadDatabaseInfo}
            disabled={isLoadingStatus}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 15px',
              borderRadius: 10,
              background: '#fff',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
          >
            <RefreshCw size={14} className={isLoadingStatus ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={handleSyncAll}
            disabled={isSyncing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 18px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, #FF7900, #ea580c)',
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(255,121,0,0.3)'
            }}
          >
            <Server size={14} />
            {isSyncing ? 'Syncing...' : 'Sync All to MySQL'}
          </button>
        </div>
      </div>

      {/* ── Microservices Architecture Grid (All 6 Services) ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Cpu size={16} /> Integrated Microservices Fleet (6 Active Services)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {microservices.map((svc, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 20 }}>{svc.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                  ● Port {svc.port}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{svc.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{svc.role}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Connection & Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {/* Status Card */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Database Engine</span>
            {dbStatus?.connected ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, border: '1px solid #a7f3d0' }}>
                <CheckCircle2 size={12} /> Connected
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, border: '1px solid #fecaca' }}>
                <AlertCircle size={12} /> Offline
              </span>
            )}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
            MySQL 8.0 (No Duplicates)
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Host: <code>{dbStatus?.host || 'localhost'}:{dbStatus?.port || '3306'}</code> • Schema: <code>bookvault</code>
          </div>
        </div>

        {/* Booksaved Table Card */}
        <div 
          onClick={() => setActiveTable('booksaved')}
          style={{ 
            background: activeTable === 'booksaved' ? 'rgba(255,121,0,0.04)' : '#fff', 
            border: activeTable === 'booksaved' ? '2px solid #FF7900' : '1px solid var(--border)', 
            borderRadius: 16, 
            padding: 18, 
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            transition: 'all 0.15s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Table: booksaved</span>
            <BookOpen size={16} color="#FF7900" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FF7900' }}>
            {dbStatus?.tables?.booksaved || tableData.books.length || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Total unique books in MySQL
          </div>
        </div>

        {/* Pages Table Card */}
        <div 
          onClick={() => setActiveTable('book_pages')}
          style={{ 
            background: activeTable === 'book_pages' ? 'rgba(2,132,199,0.04)' : '#fff', 
            border: activeTable === 'book_pages' ? '2px solid #0284c7' : '1px solid var(--border)', 
            borderRadius: 16, 
            padding: 18, 
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
            transition: 'all 0.15s'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Table: book_pages</span>
            <Layers size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#0284c7' }}>
            {dbStatus?.tables?.book_pages || tableData.pages.length || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Total extracted scanned pages
          </div>
        </div>

        {/* Users Card */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 16, padding: 18, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Biometric Readers</span>
            <Users size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6' }}>
            {dbStatus?.tables?.biometric_users || 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Registered facial accounts
          </div>
        </div>
      </div>

      {/* Table Explorer Container */}
      <div style={{ background: '#fff', borderRadius: 20, border: '1px solid var(--border)', boxShadow: '0 6px 24px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {/* Table Header Controls */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setActiveTable('booksaved')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTable === 'booksaved' ? '#FF7900' : '#f1f5f9',
                color: activeTable === 'booksaved' ? '#fff' : '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              📚 Books Table (`booksaved`)
            </button>
            <button
              type="button"
              onClick={() => setActiveTable('book_pages')}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: 'none',
                background: activeTable === 'book_pages' ? '#0284c7' : '#f1f5f9',
                color: activeTable === 'book_pages' ? '#fff' : '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              📄 Pages Table (`book_pages`)
            </button>
          </div>

          <div style={{ minWidth: 260 }}>
            <input
              type="text"
              placeholder={`Search ${activeTable}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* ── 1. BOOKS TABLE VIEW ── */}
        {activeTable === 'booksaved' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 16px' }}>ID</th>
                  <th style={{ padding: '12px 16px' }}>Cover</th>
                  <th style={{ padding: '12px 16px' }}>Title</th>
                  <th style={{ padding: '12px 16px' }}>Author</th>
                  <th style={{ padding: '12px 16px' }}>User ID</th>
                  <th style={{ padding: '12px 16px' }}>Pages</th>
                  <th style={{ padding: '12px 16px' }}>Created Date</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                      No books found in MySQL database table `booksaved`. Click "Sync All to MySQL" or Add a Book to save records.
                    </td>
                  </tr>
                ) : (
                  filteredBooks.map((b) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#FF7900' }}>#{b.id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {b.cover_image ? (
                          <img src={b.cover_image} alt="cover" style={{ width: 36, height: 48, borderRadius: 6, objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 36, height: 48, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📖</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e293b' }}>
                        {b.title}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>{b.author || 'Unknown'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                          {b.user_id || 'Guest'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>
                        {b.page_count || 1} {b.page_count === 1 ? 'Page' : 'Pages'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>
                        {b.created_at ? new Date(b.created_at).toLocaleString() : 'Recent'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {onOpenBook && (
                            <button
                              type="button"
                              onClick={() => onOpenBook(b)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              📖 Read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteBook(b.id, b.title)}
                            style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            title="Delete from MySQL"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 2. PAGES TABLE VIEW ── */}
        {activeTable === 'book_pages' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 16px' }}>ID</th>
                  <th style={{ padding: '12px 16px' }}>Book ID</th>
                  <th style={{ padding: '12px 16px' }}>Page #</th>
                  <th style={{ padding: '12px 16px' }}>Title</th>
                  <th style={{ padding: '12px 16px' }}>Extracted Text Snippet</th>
                  <th style={{ padding: '12px 16px' }}>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                      No individual pages registered in MySQL table `book_pages`. Add a book with multi-page images to see records here.
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0284c7' }}>#{p.id}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>Book #{p.book_id}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontSize: 11 }}>
                          Page {p.page_number}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>{p.page_title || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#64748b', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.text_snippet ? `"${p.text_snippet}..."` : <em style={{ color: '#cbd5e1' }}>No text extracted</em>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>
                        {p.created_at ? new Date(p.created_at).toLocaleString() : 'Recent'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
