/**
 * MySQL Database Service for Book Vault
 * Handles seamless persistence of books, multi-page scans, users, and biometrics
 * to MySQL 8.0 running on localhost:3306 (database: bookvault).
 */

const API_BASE = window.location.origin;

class MySQLService {
  /**
   * Check MySQL connection status and table statistics
   */
  async getStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/db/status`);
      if (res.ok) {
        return await res.json();
      }
      return { connected: false, status: 'offline', error: `HTTP ${res.status}` };
    } catch (err) {
      return { connected: false, status: 'offline', error: err.message };
    }
  }

  /**
   * Fetch all books uploaded by the specified user from MySQL
   */
  async getAllBooks(userId = 'Guest') {
    const effectiveUser = userId || 'Guest';
    try {
      const res = await fetch(`${API_BASE}/api/books?userId=${encodeURIComponent(effectiveUser)}`);
      if (res.ok) {
        const books = await res.json();
        if (Array.isArray(books)) {
          // Update local cache strictly for this user
          localStorage.setItem(`uploadedBooks_${effectiveUser}`, JSON.stringify(books));
          return books;
        }
      }
    } catch (err) {
      console.warn('MySQL fetch fallback to localStorage:', err.message);
    }

    // Fallback to local storage
    const local = localStorage.getItem(`uploadedBooks_${effectiveUser}`);
    return local ? JSON.parse(local) : [];
  }

  /**
   * Fetch single book with all pages from MySQL
   */
  async getBookById(id) {
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('MySQL getBookById error:', err.message);
    }
    return null;
  }

  /**
   * Save a complete book with all pages directly to MySQL database
   */
  async saveBook(bookData) {
    const payload = {
      title: bookData.title || 'Untitled Book',
      author: bookData.author || 'Unknown',
      genre: bookData.genre || 'General',
      language: bookData.language || 'eng',
      userId: bookData.userId || bookData.user_id || 'Guest',
      userName: bookData.userName || bookData.user_name || 'Reader',
      cover: bookData.cover || bookData.coverImage || '',
      coverImage: bookData.cover || bookData.coverImage || '',
      content: bookData.content || bookData.fullText || '',
      fullText: bookData.fullText || bookData.content || '',
      pages: Array.isArray(bookData.pages) ? bookData.pages : [],
      pageCount: bookData.pageCount || (bookData.pages ? bookData.pages.length : 1) || 1,
      source: bookData.source || 'scanner'
    };

    try {
      const res = await fetch(`${API_BASE}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const saved = await res.json();
        console.log('✅ [MySQL Service] Book successfully saved to MySQL database:', saved);

        // Keep local cache synchronized
        const effectiveUser = payload.userId;
        const existing = JSON.parse(localStorage.getItem(`uploadedBooks_${effectiveUser}`) || '[]');
        const updated = [saved, ...existing.filter(b => String(b.id) !== String(saved.id))];
        localStorage.setItem(`uploadedBooks_${effectiveUser}`, JSON.stringify(updated));

        return { success: true, book: saved, source: 'mysql' };
      }
    } catch (err) {
      console.warn('⚠️ [MySQL Service] Could not reach MySQL API directly, saving to local cache:', err.message);
    }

    // Offline / fallback storage
    const offlineBook = {
      ...payload,
      id: bookData.id || Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    const effectiveUser = payload.userId;
    const existing = JSON.parse(localStorage.getItem(`uploadedBooks_${effectiveUser}`) || '[]');
    const updated = [offlineBook, ...existing];
    localStorage.setItem(`uploadedBooks_${effectiveUser}`, JSON.stringify(updated));

    return { success: true, book: offlineBook, source: 'local_cache' };
  }

  /**
   * Update existing book in MySQL
   */
  async updateBook(id, updateData) {
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('MySQL updateBook error:', err.message);
    }
    return { success: false };
  }

  /**
   * Update reading position (last_position_char) in MySQL
   */
  async updatePosition(id, positionData) {
    if (!id || String(id).startsWith("local_")) {
      return { success: true, source: 'local' };
    }
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}/position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positionData)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      // Fallback to updateBook if PATCH endpoint is offline
      return this.updateBook(id, positionData);
    }
    return { success: false };
  }

  /**
   * Delete book and its pages from MySQL
   */
  async deleteBook(id, userId = 'Guest') {
    try {
      const res = await fetch(`${API_BASE}/api/books/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log(`🗑️ [MySQL Service] Book ${id} deleted from MySQL`);
      }
    } catch (err) {
      console.warn('MySQL deleteBook error:', err.message);
    }

    // Also remove from local cache
    const effectiveUser = userId || 'Guest';
    const existing = JSON.parse(localStorage.getItem(`uploadedBooks_${effectiveUser}`) || '[]');
    const filtered = existing.filter(b => String(b.id) !== String(id));
    localStorage.setItem(`uploadedBooks_${effectiveUser}`, JSON.stringify(filtered));

    return { success: true };
  }

  /**
   * Fetch raw MySQL table rows for Database Management view
   */
  async getTablesData() {
    try {
      const res = await fetch(`${API_BASE}/api/db/tables`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('MySQL getTablesData error:', err.message);
    }
    return { books: [], pages: [] };
  }

  /**
   * Batch sync all locally stored books to MySQL
   */
  async syncLocalBooksToMySQL(userId = 'Guest') {
    const effectiveUser = userId || 'Guest';
    const local = JSON.parse(localStorage.getItem(`uploadedBooks_${effectiveUser}`) || '[]');
    if (local.length === 0) return { syncedCount: 0 };

    try {
      const res = await fetch(`${API_BASE}/api/db/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books: local })
      });
      if (res.ok) {
        const result = await res.json();
        return result;
      }
    } catch (err) {
      console.warn('MySQL batch sync error:', err.message);
    }
    return { syncedCount: 0 };
  }

  /**
   * Run database deduplication and cleanup
   */
  async cleanupDuplicates() {
    try {
      const res = await fetch(`${API_BASE}/api/db/cleanup-duplicates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('MySQL cleanup error:', err.message);
    }
    return { success: false, message: 'Failed to run deduplication' };
  }
}

export const mysqlService = new MySQLService();
export default mysqlService;
