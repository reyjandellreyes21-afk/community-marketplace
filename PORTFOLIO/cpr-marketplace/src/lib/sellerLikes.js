/** Like counts and one-like-per-viewer rules for seller profiles (stored on the seller user row). */

export function getSellerLikeCount(user) {
  if (!user) return 0;
  if (Array.isArray(user.likedByUserIds)) return user.likedByUserIds.length;
  return Number(user.likes) || 0;
}

export function hasViewerLikedSeller(seller, viewerUserId) {
  if (!seller || !viewerUserId) return false;
  return Boolean(seller.likedByUserIds?.includes(viewerUserId));
}

/**
 * Adds likerId to seller's likedByUserIds once per liker (including seller liking own profile).
 * Returns new users array.
 */
export function registerSellerLike(users, sellerId, likerId) {
  if (!Array.isArray(users) || !sellerId || !likerId) return users;

  return users.map((user) => {
    if (user.id !== sellerId) return user;
    const existing = Array.isArray(user.likedByUserIds) ? user.likedByUserIds : [];
    if (existing.includes(likerId)) return user;
    const likedByUserIds = [...existing, likerId];
    return {
      ...user,
      likedByUserIds,
      likes: likedByUserIds.length,
    };
  });
}

/** Removes likerId from seller's likedByUserIds. Returns new users array. */
export function unregisterSellerLike(users, sellerId, likerId) {
  if (!Array.isArray(users) || !sellerId || !likerId) return users;

  return users.map((user) => {
    if (user.id !== sellerId) return user;
    const existing = Array.isArray(user.likedByUserIds) ? user.likedByUserIds : [];
    if (!existing.includes(likerId)) return user;
    const likedByUserIds = existing.filter((id) => id !== likerId);
    return {
      ...user,
      likedByUserIds,
      likes: likedByUserIds.length,
    };
  });
}
