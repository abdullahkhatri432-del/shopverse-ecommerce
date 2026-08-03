export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p>© {new Date().getFullYear()} ShopVerse. All rights reserved.</p>
        <p className="footer-links">
          <span>Demo store</span>
          <span>·</span>
          <span>Express + React + SQLite</span>
        </p>
      </div>
    </footer>
  );
}
