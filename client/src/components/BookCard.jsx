import { Tag, Button, Rate, Tooltip } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, BookOpen } from 'lucide-react';
import { bookGenres } from '../data/library.js';

const FALLBACK_COVER = 'https://www.gutenberg.org/pics/logo-144x144.png';

export default function BookCard({
  book,
  extra,
  coverClass = 'h-56',
  wishlisted,
  onWishlist,
  wishBusy,
  inCart,
  onCart,
  cartBusy,
  locked,
  onLocked,
}) {
  const nav = useNavigate();
  const genres = bookGenres(book).slice(0, 2);
  const cover = book.coverImage || FALLBACK_COVER;
  const isLocked = Boolean(locked || book.locked);
  const category = book.category || genres[0];
  const authors = (book.authors || []).join(', ') || 'Unknown author';
  const readerPath = `/catalog/${book._id}/read`;
  const detailsPath = `/catalog/${book._id}`;

  function openReader(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isLocked) {
      onLocked?.(book);
      return;
    }
    nav(readerPath);
  }

  function openDetails(e) {
    if (isLocked) {
      e.preventDefault();
      onLocked?.(book);
    }
  }

  return (
    <article className="book-hero-card h-full">
      <Link
        to={isLocked ? '#' : readerPath}
        onClick={(e) => {
          if (isLocked) {
            openDetails(e);
            return;
          }
          e.preventDefault();
          openReader(e);
        }}
        className={`book-hero-cover ${coverClass}`}
        aria-label={`Read ${book.title}`}
      >
        <img
          alt={book.title || 'Book cover'}
          src={cover}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.src = FALLBACK_COVER;
          }}
        />
        <div className="book-hero-cover-shade" aria-hidden />
        <div className="book-hero-cover-meta">
          {book.isFree ? <span className="book-hero-pill free">FREE</span> : <span className="book-hero-pill">Library</span>}
          {category && <span className="book-hero-pill muted">{category}</span>}
        </div>
      </Link>

      <div className="book-hero-body">
        <Link
          to={isLocked ? '#' : readerPath}
          onClick={(e) => {
            if (isLocked) {
              openDetails(e);
              return;
            }
            e.preventDefault();
            openReader(e);
          }}
          className="book-hero-title"
        >
          {book.title}
        </Link>
        <p className="book-hero-author">{authors}</p>
        {book.summary && <p className="book-hero-summary">{book.summary}</p>}

        <div className="book-hero-meta">
          <span className="book-hero-rating">
            <Rate disabled allowHalf value={book.averageRating || 0} style={{ fontSize: 12 }} />
            <span>({book.reviewCount || 0})</span>
          </span>
          {book.availableCopies != null && (
            <Tag color={book.availableCopies > 0 ? 'success' : 'error'} className="m-0">
              {book.availableCopies} avail
            </Tag>
          )}
        </div>

        {genres.length > 0 && (
          <div className="book-hero-genres">
            {genres.map((g) => (
              <Tag key={g} className="genre-tag m-0">
                {g}
              </Tag>
            ))}
          </div>
        )}

        <div className="book-hero-actions">
          <Button type="primary" size="middle" icon={<BookOpen size={14} />} onClick={openReader} className="book-hero-primary">
            Read Book
          </Button>
          <Button size="middle" onClick={() => (isLocked ? onLocked?.(book) : nav(detailsPath))}>
            Details
          </Button>
          {onWishlist && (
            <Tooltip title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
              <Button
                size="middle"
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className={wishlisted ? 'wishlist-btn wishlist-btn-on' : 'wishlist-btn'}
                icon={<Heart size={14} fill={wishlisted ? 'currentColor' : 'none'} />}
                loading={wishBusy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onWishlist(book, !wishlisted);
                }}
              >
                {wishlisted ? 'Saved' : 'Wishlist'}
              </Button>
            </Tooltip>
          )}
          {onCart && (
            <Tooltip title={inCart ? 'Remove from cart' : 'Add to cart'}>
              <Button
                size="middle"
                aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
                className={inCart ? 'cart-btn cart-btn-on' : 'cart-btn'}
                icon={<ShoppingCart size={14} />}
                loading={cartBusy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCart(book, !inCart);
                }}
              >
                {inCart ? 'In cart' : 'Add to Cart'}
              </Button>
            </Tooltip>
          )}
        </div>
        {extra}
      </div>
    </article>
  );
}
