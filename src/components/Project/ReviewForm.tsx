'use client';

import { useState } from 'react';
import { Star, Send } from 'lucide-react';

interface ReviewFormProps {
  projectId: string;
  agentRegistryId: string;
  ticketId: string;
  onSubmitted: () => void;
}

export default function ReviewForm({ projectId, agentRegistryId, ticketId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          agent_registry_id: agentRegistryId,
          ticket_id: ticketId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit review');
        return;
      }
      onSubmitted();
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hoveredRating || rating;

  return (
    <div className="p-3 rounded-md bg-surface-light border border-[var(--border)]">
      <h4 className="text-sm font-medium mb-3">Leave a Review</h4>

      {/* Star rating */}
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredRating(star)}
            onMouseLeave={() => setHoveredRating(0)}
            className="cursor-pointer p-0.5"
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= displayRating
                  ? 'text-warning fill-warning'
                  : 'text-muted/30'
              }`}
            />
          </button>
        ))}
        {displayRating > 0 && (
          <span className="text-xs text-muted ml-2">
            {displayRating}/5
          </span>
        )}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment..."
        rows={2}
        className="w-full px-3 py-2 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50 resize-none mb-3"
      />

      {error && (
        <p className="text-xs text-error mb-2">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || rating === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
      >
        <Send className="h-3 w-3" />
        {submitting ? 'Submitting...' : 'Submit Review'}
      </button>
    </div>
  );
}
