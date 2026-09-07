import { Card, Tag, Button, Rate } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { bookGenres } from '../data/library.js';

const FALLBACK_COVER = 'https://www.gutenberg.org/pics/logo-144x144.png';

export default function BookCard({ book, extra, coverClass = 'h-44', wishlisted, onWishlist, wishBusy, inCart, onCart, cartBusy, locked, onLocked }) {
  const nav = useNavigate();
  const genres = bookGenres(book).slice(0, 2);
  const cover = book.coverImage || FALLBACK_COVER;
  const isLocked = Boolean(locked || book.locked);

  function open() {
    if (isLocked) {
      onLocked?.(book);
      return;
    }
    nav(book.isFree ? `/catalog/${book._id}/read` : `/catalog/${book._id}`);
  }

  function openDetails(e) {
    if (isLocked) {
      e.preventDefault();
      onLocked?.(book);
    }
  }

  return (
    <Card
      hoverable={false}
      className="book-card h-full overflow-hidden"
      cover={
        <Link to={isLocked ? '#' : `/catalog/${book._id}`} onClick={openDetails} className={`book-card-cover ${coverClass} block`} aria-label={`Open ${book.title}`}>
          <img
            alt={book.title || 'Book cover'}
            src={cover}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_COVER;
            }}
          />
        </Link>
      }
    >
      <Card.Meta
        title={
          <Link to={isLocked ? '#' : `/catalog/${book._id}`} onClick={openDetails} className="line-clamp-2 text-[color:var(--text-color)]">
            {book.title}
          </Link>
        }
        description={
          <div>
            <div className="truncate text-[color:var(--muted-text)]">{(book.authors || []).join(', ')}</div>
            {book.catalogId && <div className="truncate text-xs text-[color:var(--muted-text)]">{book.catalogId}</div>}
            {book.summary && <p className="mt-1 line-clamp-2 text-xs text-[color:var(--muted-text)]">{book.summary}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {book.isFree ? <Tag color="green">FREE</Tag> : <Tag>Library</Tag>}
              {genres.map((g) => (
                <Tag key={g} className="genre-tag m-0">
                  {g}
                </Tag>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-xs">
                <Rate disabled allowHalf value={book.averageRating || 0} style={{ fontSize: 12 }} />
                <span className="text-[color:var(--muted-text)]">({book.reviewCount || 0})</span>
              </span>
              {book.availableCopies != null && (
                <Tag color={book.availableCopies > 0 ? 'success' : 'error'}>{book.availableCopies} avail</Tag>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="primary"
                size="small"
                onClick={open}
              >
                {isLocked ? 'Read / Open' : book.isFree ? 'Read Now' : 'Open Book'}
              </Button>
              {onWishlist && (
                <Button
                  size="small"
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  className={wishlisted ? 'wishlist-btn wishlist-btn-on' : 'wishlist-btn'}
                  icon={<Heart size={14} fill={wishlisted ? 'currentColor' : 'none'} />}
                  loading={wishBusy}
                  onClick={(e) => {
                    e.preventDefault();
                    onWishlist(book, !wishlisted);
                  }}
                >
                  {wishlisted ? 'Saved' : 'Wishlist'}
                </Button>
              )}
              {onCart && (
                <Button
                  size="small"
                  aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
                  icon={<ShoppingCart size={14} />}
                  loading={cartBusy}
                  onClick={(e) => {
                    e.preventDefault();
                    onCart(book, !inCart);
                  }}
                >
                  {inCart ? 'In cart' : 'Add to Cart'}
                </Button>
              )}
            </div>
            {extra}
          </div>
        }
      />
    </Card>
  );
}
