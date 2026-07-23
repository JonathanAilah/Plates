'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, ShoppingBag, ChefHat, Bell, X, Plus, MapPin, Camera, ArrowLeft, Search, Compass, Receipt, User as UserIcon, Minus, Trash2, Map as MapIcon, Navigation, MessageCircle, Send, Sparkles, LogIn, Shield, CheckCircle, XCircle, Pause, Play, UserX, UserCheck, ChevronRight, Star } from 'lucide-react';
import { SignInButton, SignedIn, SignedOut, UserButton, useUser, useAuth } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import { CURRENT_TERMS_VERSION } from '@/lib/legal';

// Heavy, screen-specific components (Leaflet map, Stripe checkout, address
// autocomplete) are code-split out of the initial bundle and loaded on demand.
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false });
const AddressAutocomplete = dynamic(() => import('@/components/AddressAutocomplete'), { ssr: false });
const CheckoutPayment = dynamic(() => import('@/components/CheckoutPayment'), { ssr: false });

interface Dish {
  id: number;
  name: string;
  seller_id: number;
  seller_name: string;
  seller_avatar: string;
  seller_photo_url: string | null;
  seller_latitude: number | null;
  seller_longitude: number | null;
  seller_kitchen_flags: string | null;
  seller_kitchen_environment: string | null;
  seller_pickup_description: string | null;
  seller_cooking_hours: string | null;
  seller_pickup_min_minutes: number | null;
  seller_pickup_max_minutes: number | null;
  emoji: string;
  photo_url: string | null;
  price: number;
  likes: number;
  description: string;
  liked?: boolean;
  avg_rating?: number | string | null;
  review_count?: number;
  is_featured?: boolean;
  is_hidden_from_profile?: boolean;
}

interface Review {
  id: number;
  dish_id: number;
  buyer_id: number;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_name: string;
  buyer_avatar: string;
  buyer_photo_url: string | null;
}

interface UnreviewedOrder {
  order_id: string;
  dish_id: number;
  created_at: string;
  updated_at: string;
  dish_name: string;
  dish_emoji: string;
  dish_photo_url: string | null;
  seller_name: string;
  seller_kitchen_name: string | null;
}

interface Post {
  id: number;
  user_id: number;
  body: string;
  photo_url: string | null;
  created_at: string;
  expires_at: string;
  author_name: string;
  author_avatar: string;
  author_photo_url: string | null;
  author_seller_status: string;
  author_kitchen_name: string | null;
  heart_count: number;
  fire_count: number;
  hands_count: number;
  comment_count: number;
  viewer_reactions: string[];
  post_latitude: number | null;
  post_longitude: number | null;
  distance_mi: number | null; // null if we couldn't compute (viewer or post has no location)
}

interface PostComment {
  id: number;
  post_id: number;
  user_id: number;
  body: string;
  created_at: string;
  author_name: string;
  author_avatar: string;
  author_photo_url: string | null;
}

interface CartItem {
  cart_item_id: number;
  id: number;
  name: string;
  emoji: string;
  photo_url: string | null;
  price: number;
  description: string;
  quantity: number;
  seller_name: string;
  seller_photo_url: string | null;
  seller_latitude: number | null;
  seller_longitude: number | null;
  seller_pickup_min_minutes: number | null;
  seller_pickup_max_minutes: number | null;
}

type OrderStatus = 'placed' | 'accepted' | 'cooking' | 'ready' | 'picked_up' | 'cancelled';

interface BuyerOrder {
  id: string;
  buyer_id: number;
  dish_id: number;
  quantity: number;
  total_price: string;
  status: OrderStatus;
  pickup_code: string | null;
  created_at: string;
  updated_at: string;
  pickup_at: string | null;
  dish_name: string;
  dish_emoji: string;
  dish_photo_url: string | null;
  dish_price: string;
  seller_id: number;
  seller_name: string;
  seller_avatar: string;
  seller_photo_url: string | null;
  seller_latitude: number | null;
  seller_longitude: number | null;
  seller_address: string | null;
  seller_kitchen_name: string | null;
  seller_cooking_hours: string | null;
  seller_pickup_description: string | null;
}

interface CookOrder {
  id: string;
  buyer_id: number;
  dish_id: number;
  quantity: number;
  total_price: string;
  status: OrderStatus;
  pickup_code: string | null;
  created_at: string;
  updated_at: string;
  pickup_at: string | null;
  dish_name: string;
  dish_emoji: string;
  dish_photo_url: string | null;
  buyer_name: string;
  buyer_avatar: string;
  buyer_photo_url: string | null;
}

interface Message {
  id: number;
  order_id: string;
  sender_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
  sender_name: string;
  sender_avatar: string;
  sender_photo_url: string | null;
}

interface AdminStats {
  pending: number;
  sellers: number;
  suspended: number;
  admins: number;
  totalUsers: number;
  totalDishes: number;
  totalOrders: number;
  orphanDishes: number;
}

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  avatar: string;
  photo_url: string | null;
  role: 'user' | 'admin';
  seller_status: string;
  account_disabled: boolean;
  kitchen_name: string | null;
  created_at: string;
}

interface AdminUserDetail {
  user: any;
  stats: { dishes: number; ordersAsBuyer: number; ordersAsSeller: number };
}

interface AdminDishRow {
  id: number;
  name: string;
  emoji: string;
  photo_url: string | null;
  price: string;
  likes: number;
  created_at: string;
  seller_id: number;
  seller_name: string;
  seller_status: string;
}

interface Notification {
  id: number;
  type: 'payment' | 'ready';
  message: string;
}

interface User {
  id: number;
  name: string;
  is_seller: boolean;
  avatar: string;
  bio: string;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  prep_address: string | null;
  legal_name: string | null;
  kitchen_name: string | null;
  cottage_food_attested: boolean;
  has_permit: boolean | null;
  permit_number: string | null;
  kitchen_flags: string | null;
  kitchen_environment: string | null;
  cooking_hours: string | null;
  pickup_description: string | null;
  pickup_min_minutes: number | null;
  pickup_max_minutes: number | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  role: 'user' | 'admin';
  seller_status: 'not_seller' | 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason: string | null;
  suspended_reason: string | null;
  account_disabled: boolean;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
}

function distanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function etaMinutes(miles: number): number {
  return Math.max(10, Math.round(15 + miles * 8));
}

// Discover feed: how many dishes to load per page, and the default radius (mi)
// used to fetch only nearby dishes once the viewer's location is known.
const DISH_PAGE_SIZE = 24;
const NEARBY_RADIUS_MI = 10;

async function uploadImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxDimension = 900;
        let { width, height } = img;
        if (width > height && width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Design tokens matching the mockup
const C = {
  page: '#eae4d9',
  surface: '#f7f3ec',
  card: '#fffdf8',
  cardAlt: '#efe7da',
  terracotta: '#c8552b',
  terracottaDark: '#a8431f',
  terracottaLight: '#fbeae2',
  green: '#3d6b47',
  greenLight: '#eaf0ea',
  gold: '#b8860b',
  ink: '#2a2320',
  inkSoft: '#5f5549',
  muted: '#8a7f74',
  mutedLight: '#a99e91',
  divider: '#e2d8c7',
  hairline: 'rgba(0,0,0,.07)',
};

const font = {
  serif: "'Zilla Slab', Georgia, serif",
  sans: "'DM Sans', system-ui, sans-serif",
};

export default function Home() {
  const [screen, setScreen] = useState<'feed' | 'meal' | 'cart' | 'checkout-payment' | 'profile' | 'seller-dashboard' | 'cook-profile' | 'notifications' | 'orders' | 'order-detail' | 'kitchen-queue' | 'chat' | 'admin' | 'admin-pending' | 'admin-users' | 'admin-user-detail' | 'admin-dishes'>('feed');
  const [user, setUser] = useState<User | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishOffset, setDishOffset] = useState(0);
  const [dishHasMore, setDishHasMore] = useState(false);
  const [loadingMoreDishes, setLoadingMoreDishes] = useState(false);
  const [nearbyRadiusMi, setNearbyRadiusMi] = useState<number>(NEARBY_RADIUS_MI);
  const [showNearbyPanel, setShowNearbyPanel] = useState(false);
  // Server-side search results (whole catalog), separate from the nearby feed.
  const [searchResults, setSearchResults] = useState<Dish[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [cookOrders, setCookOrders] = useState<CookOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<BuyerOrder | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [mealQty, setMealQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myDishes, setMyDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSignedIn, isLoaded } = useAuth();

  // The viewer's location for the dish feed, or null if unknown (anonymous or
  // location not yet granted). When null, the feed falls back to newest-first.
  const currentDishLoc = (): { lat: number; lng: number } | null =>
    user && user.latitude != null && user.longitude != null
      ? { lat: user.latitude, lng: user.longitude }
      : null;

  // Fetch one page of the dish feed. `replace` starts a fresh list (offset 0);
  // otherwise the page is appended. Keeps the query bounded (radius + limit)
  // instead of loading every dish in the marketplace.
  const loadDishesPage = async (
    offset: number,
    replace: boolean,
    loc: { lat: number; lng: number } | null
  ): Promise<Dish[]> => {
    const params = new URLSearchParams();
    params.set('action', 'getAll');
    params.set('limit', String(DISH_PAGE_SIZE));
    params.set('offset', String(offset));
    if (loc) {
      params.set('lat', String(loc.lat));
      params.set('lng', String(loc.lng));
      params.set('radiusMi', String(nearbyRadiusMi));
    }
    const res = await fetch(`/api/dishes?${params.toString()}`);
    const data = res.ok ? await res.json() : [];
    const arr: Dish[] = Array.isArray(data) ? data : [];
    setDishes(prev => (replace ? arr : [...prev, ...arr]));
    setDishHasMore(arr.length === DISH_PAGE_SIZE);
    setDishOffset(offset + arr.length);
    return arr;
  };

  const loadMoreDishes = async () => {
    if (loadingMoreDishes) return;
    setLoadingMoreDishes(true);
    try {
      await loadDishesPage(dishOffset, false, currentDishLoc());
    } catch (e) {
      console.error('Load more dishes error:', e);
    } finally {
      setLoadingMoreDishes(false);
    }
  };

  // Server-side search across the whole catalog (not just loaded pages). Runs
  // without a radius so matches anywhere are found; distance is still shown
  // client-side from the seller's coordinates. Paginated like the feed.
  const runSearch = async (query: string, offset: number, replace: boolean): Promise<void> => {
    const params = new URLSearchParams();
    params.set('action', 'getAll');
    params.set('search', query);
    params.set('limit', String(DISH_PAGE_SIZE));
    params.set('offset', String(offset));
    const res = await fetch(`/api/dishes?${params.toString()}`);
    const data = res.ok ? await res.json() : [];
    const arr: Dish[] = Array.isArray(data) ? data : [];
    setSearchResults(prev => (replace ? arr : [...prev, ...arr]));
    setSearchHasMore(arr.length === DISH_PAGE_SIZE);
    setSearchOffset(offset + arr.length);
  };

  const loadMoreSearch = async () => {
    if (searchLoading) return;
    setSearchLoading(true);
    try {
      await runSearch(searchQuery.trim(), searchOffset, false);
    } catch (e) {
      console.error('Load more search error:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    // Clerk finished loading and reports signed out, but the app still
    // holds a user in state → force a clean reload to reset everything.
    if (isLoaded && !isSignedIn && user) {
      window.location.href = '/';
    }
  }, [isLoaded, isSignedIn, user]);
  const [dishPhotoFile, setDishPhotoFile] = useState<File | null>(null);
  const [dishPhotoPreview, setDishPhotoPreview] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [tipAmount, setTipAmount] = useState(3);
  const [tipEditing, setTipEditing] = useState(false);
  const [earnings, setEarnings] = useState<any>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [pickupDurationMin, setPickupDurationMin] = useState<number>(30);
  const [toast, setToast] = useState<string | null>(null);
  const [feedView, setFeedView] = useState<'list' | 'map'>('list');
  const [showingDirections, setShowingDirections] = useState(false);
  const [tripInfo, setTripInfo] = useState<{ distanceText: string; durationText: string } | null>(null);
  const [checkoutSecrets, setCheckoutSecrets] = useState<string[]>([]);
  const [checkoutTotalLabel, setCheckoutTotalLabel] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutIntentIds, setCheckoutIntentIds] = useState<string[]>([]);

  // Cook profile form state
  const [cpLegalName, setCpLegalName] = useState('');
  const [cpKitchenName, setCpKitchenName] = useState('');
  const [cpCottage, setCpCottage] = useState(false);
  const [cpHasPermit, setCpHasPermit] = useState<boolean | null>(null);
  const [cpPermitNumber, setCpPermitNumber] = useState('');
  const [cpFlagPets, setCpFlagPets] = useState(false);
  const [cpFlagSmokers, setCpFlagSmokers] = useState(false);
  const [cpFlagNutFree, setCpFlagNutFree] = useState(false);
  const [cpFlagGlutenFree, setCpFlagGlutenFree] = useState(false);
  const [cpKitchenEnvironment, setCpKitchenEnvironment] = useState<string>('');
  const [cpPickupMin, setCpPickupMin] = useState<number>(15);
  const [cpPickupMax, setCpPickupMax] = useState<number>(120);
  const [cpCookingHours, setCpCookingHours] = useState('');
  const [cpPickupDesc, setCpPickupDesc] = useState('');
  const [cpSaving, setCpSaving] = useState(false);

  // Chat state
  const [chatOrder, setChatOrder] = useState<BuyerOrder | CookOrder | null>(null);
  const [chatOtherPartyName, setChatOtherPartyName] = useState('');
  const [chatOtherPartyPhoto, setChatOtherPartyPhoto] = useState<string | null>(null);
  const [chatOtherPartyAvatar, setChatOtherPartyAvatar] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadByOrder, setUnreadByOrder] = useState<Record<string, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [generatingPhotoFor, setGeneratingPhotoFor] = useState<number | null>(null);
  const [confirmingPickupFor, setConfirmingPickupFor] = useState<string | null>(null);
  const [confirmingCookCancelFor, setConfirmingCookCancelFor] = useState<string | null>(null);
  const [cookCancelSubmitting, setCookCancelSubmitting] = useState(false);
  const [pickupCodeInput, setPickupCodeInput] = useState<string[]>(['', '', '', '']);
  const [pickupCodeError, setPickupCodeError] = useState(false);
  const [pickupCodeSubmitting, setPickupCodeSubmitting] = useState(false);
  const pickupInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Admin state
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminFinancials, setAdminFinancials] = useState<any>(null);
  const [adminPending, setAdminPending] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [adminUserFilter, setAdminUserFilter] = useState<'all' | 'pending' | 'sellers' | 'suspended' | 'admins' | 'disabled'>('all');
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminSelectedUser, setAdminSelectedUser] = useState<AdminUserDetail | null>(null);
  const [adminDeleteConfirmingFor, setAdminDeleteConfirmingFor] = useState<number | null>(null);
  const [adminDeleteChecked, setAdminDeleteChecked] = useState(false);
  const [adminSelectedUserOrders, setAdminSelectedUserOrders] = useState<any[]>([]);
  const [adminDishes, setAdminDishes] = useState<AdminDishRow[]>([]);
  const [adminDishSearch, setAdminDishSearch] = useState('');
  const [adminActionSubmitting, setAdminActionSubmitting] = useState(false);
  const [adminRejectReason, setAdminRejectReason] = useState('');
  const [adminSuspendReason, setAdminSuspendReason] = useState('');
  const [adminShowRejectFor, setAdminShowRejectFor] = useState<number | null>(null);
  const [adminShowSuspendFor, setAdminShowSuspendFor] = useState<number | null>(null);

  // Reviews state
  const [mealReviews, setMealReviews] = useState<Review[]>([]);
  const [pendingRating, setPendingRating] = useState<UnreviewedOrder | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [dismissedRatings, setDismissedRatings] = useState<string[]>([]);

  // Discover search + filters
  const [searchQuery, setSearchQuery] = useState('');
  const [distanceFilter, setDistanceFilter] = useState<'any' | '1mi' | '3mi' | '5mi'>('any');
  const [dietaryFilter, setDietaryFilter] = useState<string[]>([]); // e.g. ['Nut-free', 'Gluten-free']
  const [ratingFilter, setRatingFilter] = useState<'any' | '4plus' | '4half'>('any');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Community feed
  const [homeTab, setHomeTab] = useState<'discover' | 'feed'>('discover');
  const [posts, setPosts] = useState<Post[]>([]);
  const [composerText, setComposerText] = useState('');
  const [composerPhoto, setComposerPhoto] = useState<string | null>(null);
  const [composerPhotoName, setComposerPhotoName] = useState<string | null>(null);
  const [composerPosting, setComposerPosting] = useState(false);
  const composerFileInputRef = useRef<HTMLInputElement>(null);
  const [expandedCommentsFor, setExpandedCommentsFor] = useState<number | null>(null);
  const [postComments, setPostComments] = useState<Record<number, PostComment[]>>({});
  const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});
  const [commentPosting, setCommentPosting] = useState<number | null>(null);

  // Feed proximity — viewer's CURRENT location (refreshed each session)
  const [feedLat, setFeedLat] = useState<number | null>(null);
  const [feedLng, setFeedLng] = useState<number | null>(null);
  const [feedLocationStatus, setFeedLocationStatus] = useState<'unknown' | 'requesting' | 'granted' | 'denied'>('unknown');
  const [feedRadiusMi, setFeedRadiusMi] = useState<number>(5); // default 5 miles
  const [showRadiusPanel, setShowRadiusPanel] = useState(false);

  // Terms acceptance modal
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsSubmitting, setTermsSubmitting] = useState(false);

  const dishFileInputRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const loadCart = async (userId: number) => {
    try {
      const res = await fetch(`/api/cart?buyerId=${userId}`);
      const data = await res.json();
      setCart(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Cart load error:', e);
    }
  };

  const loadOrders = async (userId: number) => {
    try {
      const res = await fetch(`/api/orders?action=getUser&userId=${userId}`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
      // Keep selectedOrder in sync if it's currently viewed
      if (selectedOrder && Array.isArray(data)) {
        const fresh = data.find((o: BuyerOrder) => o.id === selectedOrder.id);
        if (fresh) setSelectedOrder(fresh);
      }
    } catch (e) {
      console.error('Orders load error:', e);
    }
  };

  const loadCookOrders = async (userId: number) => {
    try {
      const res = await fetch(`/api/orders?action=getSeller&sellerId=${userId}`);
      const data = await res.json();
      setCookOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Cook orders load error:', e);
    }
  };
  const loadEarnings = async () => {
    try {
      const res = await fetch('/api/stripe/earnings');
      if (!res.ok) return;
      const data = await res.json();
      setEarnings(data);
    } catch (e) {
      console.error('Load earnings error:', e);
    }
  };
  const loadMessages = async (orderId: string, userId: number) => {
    try {
      const res = await fetch(`/api/messages?action=list&orderId=${orderId}&userId=${userId}`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Messages load error:', e);
    }
  };

  const loadUnreadCounts = async (userId: number) => {
    try {
      const res = await fetch(`/api/messages?action=unreadCounts&userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const map: Record<string, number> = {};
        for (const row of data) map[row.order_id] = row.unread;
        setUnreadByOrder(map);
      }
    } catch (e) {
      console.error('Unread counts error:', e);
    }
  };

  // ============ ADMIN LOADERS ============

  const loadAdminStats = async () => {
    try {
      const res = await fetch('/api/admin?action=stats');
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      }
    } catch (e) { console.error('Admin stats error:', e); }
  };
  const loadAdminFinancials = async () => {
    try {
      const res = await fetch('/api/admin?action=financials');
      if (!res.ok) return;
      const data = await res.json();
      setAdminFinancials(data);
    } catch (e) {
      console.error('Load admin financials error:', e);
    }
  };
  const loadAdminPending = async () => {
    try {
      const res = await fetch('/api/admin?action=pending');
      if (res.ok) {
        const data = await res.json();
        setAdminPending(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Admin pending error:', e); }
  };

  const loadAdminUsers = async () => {
    try {
      const params = new URLSearchParams({ action: 'users', filter: adminUserFilter });
      if (adminUserSearch.trim()) params.set('search', adminUserSearch.trim());
      const res = await fetch(`/api/admin?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAdminUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Admin users error:', e); }
  };

  const loadAdminUserDetail = async (userId: number) => {
    try {
      const [detailRes, ordersRes] = await Promise.all([
        fetch(`/api/admin?action=userDetail&userId=${userId}`),
        fetch(`/api/admin?action=userOrders&userId=${userId}`),
      ]);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setAdminSelectedUser(detail);
      }
      if (ordersRes.ok) {
        const orders = await ordersRes.json();
        setAdminSelectedUserOrders(Array.isArray(orders) ? orders : []);
      }
      setScreen('admin-user-detail');
    } catch (e) { console.error('Admin user detail error:', e); }
  };

  const loadAdminDishes = async () => {
    try {
      const params = new URLSearchParams({ action: 'dishes' });
      if (adminDishSearch.trim()) params.set('search', adminDishSearch.trim());
      const res = await fetch(`/api/admin?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAdminDishes(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Admin dishes error:', e); }
  };

  const adminAction = async (payload: Record<string, any>): Promise<any | null> => {
    setAdminActionSubmitting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Action failed');
        return null;
      }
      return data;
    } catch (e) {
      console.error('Admin action error:', e);
      showToast('Network error');
      return null;
    } finally {
      setAdminActionSubmitting(false);
    }
  };

  const adminApproveSeller = async (userId: number) => {
    const result = await adminAction({ action: 'approveSeller', userId });
    if (result) {
      showToast('Seller approved');
      await loadAdminStats();
      await loadAdminPending();
      // Refresh the currently-open user detail if applicable
      if (adminSelectedUser?.user?.id === userId) await loadAdminUserDetail(userId);
    }
  };

  const adminRejectSeller = async (userId: number, reason: string) => {
    if (!reason.trim()) { showToast('Reason required'); return; }
    const result = await adminAction({ action: 'rejectSeller', userId, reason });
    if (result) {
      showToast('Seller rejected');
      setAdminShowRejectFor(null);
      setAdminRejectReason('');
      await loadAdminStats();
      await loadAdminPending();
      if (adminSelectedUser?.user?.id === userId) await loadAdminUserDetail(userId);
    }
  };

  const adminSuspendSeller = async (userId: number, reason: string) => {
    if (!reason.trim()) { showToast('Reason required'); return; }
    const result = await adminAction({ action: 'suspendSeller', userId, reason });
    if (result) {
      showToast('Seller suspended');
      setAdminShowSuspendFor(null);
      setAdminSuspendReason('');
      await loadAdminStats();
      if (adminSelectedUser?.user?.id === userId) await loadAdminUserDetail(userId);
    }
  };

  const adminUnsuspendSeller = async (userId: number) => {
    const result = await adminAction({ action: 'unsuspendSeller', userId });
    if (result) {
      showToast('Seller reinstated');
      if (adminSelectedUser?.user?.id === userId) await loadAdminUserDetail(userId);
    }
  };

  const adminToggleDisabled = async (userId: number, disabled: boolean) => {
    const result = await adminAction({ action: 'setDisabled', userId, disabled });
    if (result) {
      showToast(disabled ? 'Account disabled' : 'Account re-enabled');
      if (adminSelectedUser?.user?.id === userId) await loadAdminUserDetail(userId);
    }
  };

  const adminDeleteUser = async (userId: number) => {
    const result = await adminAction({ action: 'deleteUser', userId });
    if (result) {
      const refundedText = result.refundedOrderCount > 0
        ? `, refunded ${result.refundedOrderCount} order${result.refundedOrderCount === 1 ? '' : 's'}`
        : '';
      showToast(`Deleted ${result.deletedUserEmail}${refundedText}`);
      setAdminDeleteConfirmingFor(null);
      setAdminDeleteChecked(false);
      setScreen('admin-users');           // Navigate away FIRST — detail render would crash on null user
      setAdminSelectedUser(null);         // Bounce back to users list (current detail is stale)
      setAdminSelectedUserOrders([]);
    }
  };

  const adminSetRole = async (userId: number, role: 'user' | 'admin') => {
    const result = await adminAction({ action: 'setRole', userId, role });
    if (result) {
      showToast(role === 'admin' ? 'Promoted to admin' : 'Admin removed');
      if (adminSelectedUser?.user?.id === userId) await loadAdminUserDetail(userId);
    }
  };

  const adminDeleteDishAction = async (dishId: number) => {
    if (!confirm('Delete this dish permanently? This cannot be undone.')) return;
    const result = await adminAction({ action: 'deleteDish', dishId });
    if (result) {
      showToast('Dish deleted');
      setAdminDishes(prev => prev.filter(d => d.id !== dishId));
      await loadAdminStats();
    }
  };

  // Accept the current Terms + Privacy Policy. Called from the blocking modal.
  const handleAcceptTerms = async () => {
    if (!user || !termsChecked || termsSubmitting) return;
    setTermsSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acceptTerms', version: CURRENT_TERMS_VERSION }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not save');
        return;
      }
      setUser(data);
      setTermsChecked(false);
      showToast('Welcome to Plates');
    } catch (e) {
      console.error('Accept terms error:', e);
      showToast('Network error');
    } finally {
      setTermsSubmitting(false);
    }
  };

  const submitForReview = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submitForReview' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.missing?.length) {
          showToast(`Complete: ${data.missing.join(', ')}`);
        } else {
          showToast(data.error || 'Could not submit');
        }
        return;
      }
      setUser(data);
      showToast('Submitted for review — admin will review shortly');
    } catch (e) {
      console.error('Submit for review error:', e);
    }
  };

  // ============ REVIEWS ============

  const loadReviewsForDish = async (dishId: number) => {
    try {
      const res = await fetch(`/api/reviews?action=forDish&dishId=${dishId}`);
      const data = await res.json();
      setMealReviews(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Reviews load error:', e);
      setMealReviews([]);
    }
  };

  const checkForUnreviewedOrders = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/reviews?action=unreviewedOrders');
      if (!res.ok) return;
      const orders: UnreviewedOrder[] = await res.json();
      // Show the oldest unreviewed order first, but skip ones the user dismissed this session
      const next = orders.find(o => !dismissedRatings.includes(o.order_id));
      if (next && !pendingRating) {
        setPendingRating(next);
        setRatingStars(0);
        setRatingComment('');
      }
    } catch (e) { console.error('Unreviewed check error:', e); }
  };

  const submitRating = async () => {
    if (!pendingRating || !ratingStars || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          orderId: pendingRating.order_id,
          rating: ratingStars,
          comment: ratingComment.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not submit rating');
        return;
      }
      showToast(`Thanks for rating!`);
      setDismissedRatings(prev => [...prev, pendingRating.order_id]);
      setPendingRating(null);
      // Refresh dishes so aggregate rating updates
      await loadDishesPage(0, true, currentDishLoc());
    } catch (e) {
      console.error('Rating submit error:', e);
      showToast('Network error');
    } finally {
      setRatingSubmitting(false);
    }
  };

  const dismissRating = () => {
    if (!pendingRating) return;
    setDismissedRatings(prev => [...prev, pendingRating.order_id]);
    setPendingRating(null);
  };

  // ============ COMMUNITY FEED ============

  const loadFeed = async () => {
    try {
      const params = new URLSearchParams({ action: 'feed' });
      if (feedLat != null && feedLng != null) {
        params.set('lat', String(feedLat));
        params.set('lng', String(feedLng));
        params.set('radiusMi', String(feedRadiusMi));
      }
      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Feed load error:', e); }
  };

  // Request current location when the Feed tab is opened (each session, until granted or denied)
  const requestFeedLocation = () => {
    if (!navigator.geolocation) {
      setFeedLocationStatus('denied');
      return;
    }
    setFeedLocationStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFeedLat(pos.coords.latitude);
        setFeedLng(pos.coords.longitude);
        setFeedLocationStatus('granted');
      },
      () => {
        setFeedLocationStatus('denied');
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  };

  // Photo picker (reuses similar pattern as dish photo)
  const handleComposerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Photo must be under 3MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Downscale via canvas for consistency (max 1200px longest side)
      const img = new Image();
      img.onload = () => {
        const maxSide = 1200;
        let w = img.width, h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) { h = Math.round(h * (maxSide / w)); w = maxSide; }
          else { w = Math.round(w * (maxSide / h)); h = maxSide; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setComposerPhoto(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          setComposerPhoto(result);
        }
        setComposerPhotoName(file.name);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const publishPost = async () => {
    if (!user || composerPosting) return;
    const text = composerText.trim();
    if (!text) {
      showToast('Add some text');
      return;
    }
    setComposerPosting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', text, photoUrl: composerPhoto }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not post');
        return;
      }
      setComposerText('');
      setComposerPhoto(null);
      setComposerPhotoName(null);
      showToast('Posted');
      await loadFeed();
    } catch (e) {
      console.error('Publish post error:', e);
      showToast('Network error');
    } finally {
      setComposerPosting(false);
    }
  };

  const reactToPost = async (postId: number, kind: 'heart' | 'fire' | 'hands') => {
    if (!user) return;
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const active = p.viewer_reactions.includes(kind);
      const countKey = kind === 'heart' ? 'heart_count' : kind === 'fire' ? 'fire_count' : 'hands_count';
      return {
        ...p,
        viewer_reactions: active ? p.viewer_reactions.filter(k => k !== kind) : [...p.viewer_reactions, kind],
        [countKey]: (p as any)[countKey] + (active ? -1 : 1),
      };
    }));
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'react', postId, kind }),
      });
    } catch (e) {
      console.error('React error:', e);
      // Roll back on error by reloading
      loadFeed();
    }
  };

  const toggleComments = async (postId: number) => {
    if (expandedCommentsFor === postId) {
      setExpandedCommentsFor(null);
      return;
    }
    setExpandedCommentsFor(postId);
    // Load comments if we don't have them yet
    if (!postComments[postId]) {
      try {
        const res = await fetch(`/api/posts?action=comments&postId=${postId}`);
        const data = await res.json();
        setPostComments(prev => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
      } catch (e) { console.error('Comments load error:', e); }
    }
  };

  const publishComment = async (postId: number) => {
    if (!user || commentPosting === postId) return;
    const text = (commentDraft[postId] || '').trim();
    if (!text) return;
    setCommentPosting(postId);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'comment', postId, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not comment');
        return;
      }
      // Reload comments + bump the count locally
      const listRes = await fetch(`/api/posts?action=comments&postId=${postId}`);
      const list = await listRes.json();
      setPostComments(prev => ({ ...prev, [postId]: Array.isArray(list) ? list : [] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
      setCommentDraft(prev => ({ ...prev, [postId]: '' }));
    } catch (e) {
      console.error('Comment error:', e);
      showToast('Network error');
    } finally {
      setCommentPosting(null);
    }
  };

  const deletePostAction = async (postId: number) => {
    if (!user) return;
    if (!confirm('Delete this post?')) return;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', postId }),
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        showToast('Post deleted');
      }
    } catch (e) { console.error('Delete post error:', e); }
  };

  const deleteCommentAction = async (postId: number, commentId: number) => {
    if (!user) return;
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteComment', commentId }),
      });
      if (res.ok) {
        setPostComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p));
      }
    } catch (e) { console.error('Delete comment error:', e); }
  };

  // Format "expires in Xh Ym" or "expires in Xm"
  const expiresIn = (expiresAtIso: string): string => {
    const ms = new Date(expiresAtIso).getTime() - Date.now();
    if (ms <= 0) return 'expiring…';
    const mins = Math.floor(ms / 60000);
    const hours = Math.floor(mins / 60);
    if (hours <= 0) return `${mins}m left`;
    return `${hours}h left`;
  };

  const markThreadRead = async (orderId: string, userId: number) => {
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markRead', orderId, userId }),
      });
      setUnreadByOrder(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    } catch (e) {
      console.error('Mark read error:', e);
    }
  };

  const sendMessageAction = async (customText?: string) => {
    if (!user || !chatOrder || sending) return;
    const text = (customText ?? messageDraft).trim();
    if (!text) return;
    setSending(true);
    setMessageDraft('');
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', orderId: chatOrder.id, senderId: user.id, message: text }),
      });
      if (!res.ok) throw new Error('Send failed');
      await loadMessages(chatOrder.id, user.id);
    } catch (e) {
      console.error('Send message error:', e);
      showToast('Could not send message');
      // Restore draft on failure so user doesn't lose their text
      if (!customText) setMessageDraft(text);
    } finally {
      setSending(false);
    }
  };

  // Open chat as buyer from a buyer order
  const openChatAsBuyer = (order: BuyerOrder) => {
    if (!user) return;
    setChatOrder(order);
    setChatOtherPartyName(order.seller_kitchen_name || order.seller_name);
    setChatOtherPartyPhoto(order.seller_photo_url);
    setChatOtherPartyAvatar(order.seller_avatar);
    setMessages([]);
    loadMessages(order.id, user.id);
    markThreadRead(order.id, user.id);
    setScreen('chat');
  };

  // Open chat as cook from a cook order
  const openChatAsCook = (order: CookOrder) => {
    if (!user) return;
    setChatOrder(order);
    setChatOtherPartyName(order.buyer_name);
    setChatOtherPartyPhoto(order.buyer_photo_url);
    setChatOtherPartyAvatar(order.buyer_avatar);
    setMessages([]);
    loadMessages(order.id, user.id);
    markThreadRead(order.id, user.id);
    setScreen('chat');
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        // Load dishes (public) and the current user (null if anonymous) in
        // parallel. The dishes route migrates the schema on first hit, so no
        // separate blocking init call is needed on boot.
        const [dishRes, meRes] = await Promise.all([
          fetch(`/api/dishes?action=getAll&limit=${DISH_PAGE_SIZE}&offset=0`),
          fetch('/api/users'),
        ]);

        // First page loads newest-first (no location yet). Once the user's
        // location is known, an effect below reloads this filtered to nearby.
        const dishData = await dishRes.json();
        const dishArr: Dish[] = Array.isArray(dishData) ? dishData : [];
        setDishes(dishArr);
        setDishHasMore(dishArr.length === DISH_PAGE_SIZE);
        setDishOffset(dishArr.length);

        const currentUser: User | null = meRes.ok ? await meRes.json() : null;

        setUser(currentUser);
        if (currentUser) {
          setProfileName(currentUser.name);
          setProfileBio(currentUser.bio || '');
          loadCart(currentUser.id);
          // Kick off the unreviewed-orders prompt (only if the user has completed orders waiting)
          setTimeout(() => { checkForUnreviewedOrders(); }, 800);

          // Ask for location if we don't already have one
          if (currentUser.latitude == null && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                  const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'updateLocation', latitude, longitude }),
                  });
                  if (res.ok) {
                    const updated = await res.json();
                    setUser(updated);
                  }
                } catch (e) { console.error(e); }
              },
              () => { },
              { timeout: 8000 }
            );
          }
        }
      } catch (error) {
        console.error('Init error:', error);
        setDishes([]);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // Once the viewer's location is known (or the chosen radius changes), reload
  // the dish feed filtered to cooks within nearbyRadiusMi. Keeps the query
  // bounded instead of fetching every dish in the marketplace.
  useEffect(() => {
    if (user?.latitude == null || user?.longitude == null) return;
    loadDishesPage(0, true, { lat: user.latitude, lng: user.longitude });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.latitude, user?.longitude, nearbyRadiusMi]);

  // Debounced server-side search. Empty query clears results and the feed
  // falls back to the nearby list.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchOffset(0);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(() => {
      runSearch(q, 0, true).finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (screen === 'seller-dashboard' && user?.seller_status === 'approved') {
      loadEarnings();
    }
  }, [screen, user?.seller_status]);

  // Poll orders when on orders / order-detail / kitchen-queue screens
  useEffect(() => {
    if (!user) return;
    const isBuyerView = screen === 'orders' || screen === 'order-detail';
    const isCookView = screen === 'kitchen-queue';
    const isChatView = screen === 'chat';
    if (!isBuyerView && !isCookView && !isChatView) return;

    // Refresh immediately when the screen opens
    if (isBuyerView) loadOrders(user.id);
    if (isCookView) loadCookOrders(user.id);
    if (isChatView && chatOrder) loadMessages(chatOrder.id, user.id);

    const interval = setInterval(() => {
      if (document.hidden) return; // Save battery when tab isn't visible
      if (screen === 'orders' || screen === 'order-detail') loadOrders(user.id);
      if (screen === 'kitchen-queue') loadCookOrders(user.id);
      if (screen === 'chat' && chatOrder) {
        loadMessages(chatOrder.id, user.id);
        markThreadRead(chatOrder.id, user.id);
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, user?.id, chatOrder?.id]);

  // Load feed when switching to it (and poll while on it)
  useEffect(() => {
    if (screen !== 'feed' || homeTab !== 'feed') return;
    // Request location once per session when the tab opens
    if (feedLocationStatus === 'unknown') {
      requestFeedLocation();
    }
    loadFeed();
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadFeed();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, homeTab, feedLat, feedLng, feedRadiusMi]);

  // Background unread-count polling (any screen, so badges appear in nav / order lists)
  useEffect(() => {
    if (!user) return;
    loadUnreadCounts(user.id);
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadUnreadCounts(user.id);
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Clamp pickup duration whenever the cart changes so it stays within cook bounds
  useEffect(() => {
    if (cart.length === 0) return;
    const mins = cart.map(i => i.seller_pickup_min_minutes ?? 15);
    const maxes = cart.map(i => i.seller_pickup_max_minutes ?? 120);
    const effectiveMin = Math.max(...mins);
    const effectiveMax = Math.min(...maxes);
    if (effectiveMax <= effectiveMin) return; // Invalid range — leave alone
    if (pickupDurationMin < effectiveMin) setPickupDurationMin(effectiveMin);
    else if (pickupDurationMin > effectiveMax) setPickupDurationMin(effectiveMax);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  // Admin: poll pending count so a red banner appears when new sellers submit
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    loadAdminStats();
    const interval = setInterval(() => {
      if (document.hidden) return;
      loadAdminStats();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // Load specific admin data when opening admin screens
  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    if (screen === 'admin') loadAdminStats();
    if (screen === 'admin') loadAdminFinancials();
    if (screen === 'admin-pending') loadAdminPending();
    if (screen === 'admin-users') loadAdminUsers();
    if (screen === 'admin-dishes') loadAdminDishes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, adminUserFilter, adminUserSearch, adminDishSearch]);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (screen === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, screen]);

  const toggleLike = async (dishId: number) => {
    if (!user) return;
    try {
      const res = await fetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleLike', userId: user.id, dishId }),
      });
      const { liked } = await res.json();
      setDishes(dishes.map(d =>
        d.id === dishId
          ? { ...d, liked, likes: liked ? d.likes + 1 : Math.max(0, d.likes - 1) }
          : d
      ));
    } catch (error) { console.error(error); }
  };

  const openMeal = (dish: Dish) => {
    setSelectedDish(dish);
    setMealQty(1);
    setShowingDirections(false);
    setTripInfo(null);
    setMealReviews([]);
    loadReviewsForDish(dish.id);
    setScreen('meal');
  };

  const addToCart = async () => {
    if (!selectedDish || !user) return;
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          buyerId: user.id,
          dishId: selectedDish.id,
          quantity: mealQty,
        }),
      });
      await loadCart(user.id);
      showToast(`Added ${mealQty} × ${selectedDish.name}`);
      setScreen('feed');
    } catch (error) {
      console.error('Add to cart error:', error);
    }
  };

  const updateCartItemQty = async (cartItemId: number, quantity: number) => {
    if (!user) return;
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', cartItemId, quantity }),
      });
      await loadCart(user.id);
    } catch (error) { console.error(error); }
  };

  const removeFromCart = async (cartItemId: number) => {
    if (!user) return;
    try {
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', cartItemId }),
      });
      await loadCart(user.id);
    } catch (error) { console.error(error); }
  };

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const serviceFee = cart.length > 0 ? Math.max(0.5, subtotal * 0.05) : 0;
  const cartTotal = subtotal + serviceFee + (cart.length > 0 ? tipAmount : 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);


  // Phase 1: get PaymentIntent(s) from Stripe, then show the payment screen.
  const placeOrder = async () => {
    if (!user || cart.length === 0) return;
    setCheckoutError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipAmount, serviceFee }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || 'Could not start checkout.');
        showToast(data.error || 'Could not start checkout.');
        return;
      }
      const secrets = (data.intents || []).map((i: any) => i.clientSecret);
      const intentIds = (data.intents || []).map((i: any) => i.paymentIntentId);
      if (secrets.length === 0) {
        setCheckoutError('Nothing to charge.');
        return;
      }
      setCheckoutSecrets(secrets);
      setCheckoutIntentIds(intentIds);
      setCheckoutTotalLabel(`$${cartTotal.toFixed(2)}`);
      setScreen('checkout-payment');
    } catch (error) {
      console.error('Checkout start error:', error);
      setCheckoutError('Could not start checkout.');
    }
  };

  // Phase 2: called by the payment component after all charges succeed.
  // Now we actually create the orders + clear the cart (your original logic).
  const finalizeOrder = async () => {
    if (!user) return;
    try {
      const pickupAtIso = new Date(Date.now() + pickupDurationMin * 60_000).toISOString();
      await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          buyerId: user.id,
          tipAmount,
          serviceFee,
          pickupAt: pickupAtIso,
          paymentIntentIds: checkoutIntentIds,
        }),

      });

      const totalSnapshot = cartTotal;
      const itemCountSnapshot = cartCount;

      setCart([]);
      setCheckoutSecrets([]);
      setCheckoutIntentIds([]);
      showToast(`Order placed · $${totalSnapshot.toFixed(2)}`);
      await loadOrders(user.id);
      setScreen('orders');

      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'payment',
        message: `✓ Paid $${totalSnapshot.toFixed(2)} for ${itemCountSnapshot} item${itemCountSnapshot > 1 ? 's' : ''}`,
      }]);
    } catch (error) {
      console.error('Finalize order error:', error);
    }
  };
  const handleDishPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDishPhotoFile(file);
    setDishPhotoPreview(URL.createObjectURL(file));
  };

  // Cook drives order status transitions (accept, cooking, ready, decline).
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!user) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', orderId, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Could not update order');
        return;
      }
      await loadCookOrders(user.id);
    } catch (error) {
      console.error('Update order status error:', error);
    }
  };

  // Buyer cancels their own order.
  const cancelOrder = async (orderId: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateStatus', orderId, status: 'cancelled' }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Could not cancel order');
        return;
      }
      await loadOrders(user.id);
    } catch (error) {
      console.error('Cancel order error:', error);
    }
  };
  // Cook cancels an order they're preparing. Triggers automatic buyer refund server-side.
  const cookCancelOrder = async (orderId: string) => {
    if (!user) return;
    setCookCancelSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cookCancel', orderId }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'Could not cancel order');
        return;
      }
      setConfirmingCookCancelFor(null);
      showToast('Order cancelled Â· buyer refunded');
      await loadCookOrders(user.id);
    } catch (error) {
      console.error('Cook cancel order error:', error);
      showToast('Could not cancel order');
    } finally {
      setCookCancelSubmitting(false);
    }
  };
  const addDish = async (dishName: string, priceValue: number) => {
    if (!user) return;
    try {
      const emojis = ['🍕', '🍔', '🌮', '🍝', '🥘', '🍗', '🍜', '🍰'];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      let photoUrl: string | null = null;
      if (dishPhotoFile) {
        photoUrl = await uploadImage(dishPhotoFile);
      }

      const res = await fetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          sellerId: user.id,
          name: dishName,
          description: 'Homemade with love',
          price: priceValue,
          emoji,
          photoUrl,
        }),
      });

      const newDish = await res.json();
      const fullDish = {
        ...newDish,
        seller_name: user.name,
        seller_avatar: user.avatar,
        seller_photo_url: user.photo_url,
        seller_latitude: user.latitude,
        seller_longitude: user.longitude,
      };
      setMyDishes([...myDishes, fullDish]);
      setDishes([fullDish, ...dishes]);
      setDishPhotoFile(null);
      setDishPhotoPreview(null);
      if (dishFileInputRef.current) dishFileInputRef.current.value = '';
    } catch (error) { console.error(error); }
  };

  const updatePrice = async (dishId: number, newPrice: number) => {
    if (!newPrice || newPrice <= 0) return;
    try {
      const res = await fetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updatePrice', dishId, price: newPrice }),
      });
      const updated = await res.json();
      setMyDishes(myDishes.map(d => d.id === dishId ? { ...d, price: updated.price } : d));
      setDishes(dishes.map(d => d.id === dishId ? { ...d, price: updated.price } : d));
    } catch (error) { console.error(error); }
  };

  const confirmPickupWithCode = async (orderId: string, code: string) => {
    if (!user || code.length !== 4) return;
    setPickupCodeSubmitting(true);
    setPickupCodeError(false);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirmPickup',
          orderId,
          sellerId: user.id,
          pickupCode: code,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.codeMismatch) {
          // Trigger shake animation + clear inputs
          setPickupCodeError(true);
          setPickupCodeInput(['', '', '', '']);
          setTimeout(() => {
            setPickupCodeError(false);
            pickupInputRefs.current[0]?.focus();
          }, 500);
        } else {
          showToast(data.error || 'Could not confirm pickup');
          setConfirmingPickupFor(null);
        }
        return;
      }
      // Success — close the entry and refresh
      setConfirmingPickupFor(null);
      setPickupCodeInput(['', '', '', '']);
      showToast('Pickup confirmed');
      await loadCookOrders(user.id);
    } catch (e) {
      console.error('Confirm pickup error:', e);
      showToast('Network error');
    } finally {
      setPickupCodeSubmitting(false);
    }
  };

  const openPickupConfirmation = (orderId: string) => {
    setConfirmingPickupFor(orderId);
    setPickupCodeInput(['', '', '', '']);
    setPickupCodeError(false);
    // Focus first input after render
    setTimeout(() => pickupInputRefs.current[0]?.focus(), 50);
  };

  const handlePickupDigit = (index: number, value: string, orderId: string) => {
    // Only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...pickupCodeInput];
    next[index] = digit;
    setPickupCodeInput(next);

    if (digit && index < 3) {
      // Auto-advance
      pickupInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when 4 digits filled
    if (index === 3 && digit) {
      const code = next.join('');
      if (code.length === 4) {
        confirmPickupWithCode(orderId, code);
      }
    }
  };

  const handlePickupKey = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pickupCodeInput[index] && index > 0) {
      // Backspace on empty box → go back and clear previous
      const next = [...pickupCodeInput];
      next[index - 1] = '';
      setPickupCodeInput(next);
      pickupInputRefs.current[index - 1]?.focus();
    }
  };

  const generatePhotoForDish = async (dishId: number) => {
    if (!user || generatingPhotoFor) return;
    setGeneratingPhotoFor(dishId);
    try {
      const res = await fetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generatePhoto', userId: user.id, dishId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }));
        showToast(err.error || 'Generation failed');
        return;
      }
      const updated = await res.json();
      setMyDishes(myDishes.map(d => d.id === dishId ? { ...d, photo_url: updated.photo_url } : d));
      setDishes(dishes.map(d => d.id === dishId ? { ...d, photo_url: updated.photo_url } : d));
      showToast('Photo generated!');
    } catch (error) {
      console.error(error);
      showToast('Generation failed');
    } finally {
      setGeneratingPhotoFor(null);
    }
  };

  const removeDish = async (dishId: number) => {
    if (!confirm('Delete this dish? This cannot be undone.')) return;
    try {
      await fetch('/api/dishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', dishId }),
      });
      setMyDishes(myDishes.filter(d => d.id !== dishId));
      setDishes(dishes.filter(d => d.id !== dishId));
    } catch (error) { console.error(error); }
  };

  const toggleSellerMode = async () => {
    if (!user) return;
    // Already approved: toggle is_seller on/off directly. Approval is never lost,
    // so we never send an approved cook back through the profile form or re-review.
    if (user.seller_status === 'approved') {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggleSeller', isSeller: !user.is_seller }),
        });
        const updatedUser = await res.json();
        setUser(updatedUser);
      } catch (error) { console.error(error); }
      return;
    }
    // Not yet a seller: go fill out the profile and submit for review.
    setScreen('cook-profile');
  };

  // Converts a base64 VAPID key into the Uint8Array format the Push API expects.
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Ask the browser for notification permission and register a push
  // subscription for this cook, saving it to the server.
  const enablePushNotifications = async () => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Push notifications are not supported in this browser');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showToast('Notification permission denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          userId: user.id,
          subscription: subscription.toJSON(),
        }),
      });

      if (!res.ok) {
        showToast('Could not save notification settings');
        return;
      }

      showToast('Order notifications enabled!');
    } catch (error) {
      console.error('Push subscription error:', error);
      showToast('Could not enable notifications');
    }
  };

  const connectStripePayments = async () => {
    if (!user) return;
    setConnectingStripe(true);
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No onboarding URL returned', data);
        setConnectingStripe(false);
      }
    } catch (error) {
      console.error(error);
      setConnectingStripe(false);
    }
  };

  const handleProfilePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhotoFile(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      let photoUrl = user.photo_url;
      if (profilePhotoFile) {
        const uploaded = await uploadImage(profilePhotoFile);
        if (uploaded) photoUrl = uploaded;
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          id: user.id, name: profileName, bio: profileBio, photoUrl,
        }),
      });
      const updated = await res.json();
      setUser(updated);
      setProfilePhotoFile(null);
      setProfilePhotoPreview(null);
    } catch (error) { console.error(error); }
    finally { setSavingProfile(false); }
  };

  const requestLocation = () => {
    if (!user || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateLocation', id: user.id, latitude, longitude }),
        });
        const updated = await res.json();
        setUser(updated);
      },
      () => { },
      { timeout: 8000 }
    );
  };

  const saveAddress = async (address: string, latitude: number, longitude: number) => {
    if (!user) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateAddress', id: user.id, address, latitude, longitude }),
      });
      const updated = await res.json();
      setUser(updated);
      showToast('Kitchen address saved');
    } catch (error) {
      console.error('Save address error:', error);
    }
  };

  const openCookProfile = () => {
    if (!user) return;
    // Prefill form from existing user data
    setCpLegalName(user.legal_name || '');
    setCpKitchenName(user.kitchen_name || '');
    setCpCottage(!!user.cottage_food_attested);
    setCpHasPermit(user.has_permit);
    setCpPermitNumber(user.permit_number || '');
    setCpCookingHours(user.cooking_hours || '');
    setCpPickupDesc(user.pickup_description || '');
    setCpKitchenEnvironment(user.kitchen_environment || '');
    setCpPickupMin(user.pickup_min_minutes ?? 15);
    setCpPickupMax(user.pickup_max_minutes ?? 120);
    const flags = (user.kitchen_flags || '').split(',').map(s => s.trim());
    setCpFlagPets(flags.includes('pets'));
    setCpFlagSmokers(flags.includes('smokers'));
    setCpFlagNutFree(flags.includes('nut-free'));
    setCpFlagGlutenFree(flags.includes('gluten-free'));
    setScreen('cook-profile');
  };

  const saveCookProfile = async () => {
    if (!user) return;
    setCpSaving(true);
    try {
      const flags = [
        cpFlagPets && 'pets',
        cpFlagSmokers && 'smokers',
        cpFlagNutFree && 'nut-free',
        cpFlagGlutenFree && 'gluten-free',
      ].filter(Boolean).join(',');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateCookProfile',
          id: user.id,
          legalName: cpLegalName || null,
          kitchenName: cpKitchenName || null,
          cottageFoodAttested: cpCottage,
          hasPermit: cpHasPermit,
          permitNumber: cpPermitNumber || null,
          kitchenFlags: flags || null,
          kitchenEnvironment: cpKitchenEnvironment || null,
          cookingHours: cpCookingHours || null,
          pickupDescription: cpPickupDesc || null,
          pickupMinMinutes: cpPickupMin,
          pickupMaxMinutes: cpPickupMax,
        }),
      });
      const updated = await res.json();
      setUser(updated);
      showToast('Kitchen profile saved');
      setScreen('seller-dashboard');
    } catch (error) {
      console.error('Save cook profile error:', error);
    } finally {
      setCpSaving(false);
    }
  };

  // ===== MEMOS BEFORE EARLY RETURNS =====
  // React requires the same hooks in the same order on every render.
  // These must be declared BEFORE any `if (loading) return` or `if (!user) return`.
  // Guarded against null user.

  const availableDietaryTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const d of dishes) {
      if (d.seller_kitchen_flags) {
        d.seller_kitchen_flags.split(',').map(f => f.trim()).filter(Boolean).forEach(f => set.add(f));
      }
    }
    return Array.from(set).sort();
  }, [dishes]);

  const activeFilterCount = (distanceFilter !== 'any' ? 1 : 0) + (ratingFilter !== 'any' ? 1 : 0) + dietaryFilter.length;

  const filteredDishes = React.useMemo(() => {
    // When searching, results come from the server (whole catalog); otherwise
    // refine the nearby feed. Remaining filters apply client-side either way.
    const source = searchQuery.trim() ? searchResults : dishes;
    return source.filter(d => {
      if (distanceFilter !== 'any') {
        // If user isn't loaded / has no location, distance filter can't match anything
        if (!user || user.latitude == null || user.longitude == null || d.seller_latitude == null || d.seller_longitude == null) return false;
        const dist = distanceMiles(user.latitude, user.longitude, d.seller_latitude, d.seller_longitude);
        const maxMi = distanceFilter === '1mi' ? 1 : distanceFilter === '3mi' ? 3 : 5;
        if (dist > maxMi) return false;
      }
      if (ratingFilter !== 'any') {
        const avg = Number(d.avg_rating || 0);
        const threshold = ratingFilter === '4plus' ? 4 : 4.5;
        if (avg < threshold) return false;
      }
      if (dietaryFilter.length > 0) {
        const dishTags = (d.seller_kitchen_flags || '').split(',').map(f => f.trim());
        for (const tag of dietaryFilter) {
          if (!dishTags.includes(tag)) return false;
        }
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishes, searchResults, searchQuery, distanceFilter, ratingFilter, dietaryFilter, user?.latitude, user?.longitude]);

  const isFiltering = searchQuery.trim().length > 0 || activeFilterCount > 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.page, color: C.muted }}>
        <div style={{ textAlign: 'center' }}>
          <ChefHat size={44} style={{ marginBottom: 14, color: C.terracotta, opacity: .8 }} />
          <p style={{ fontFamily: font.sans, fontSize: 15 }}>Loading…</p>
        </div>
      </div>
    );
  }

  // ===== Small display helpers used by both anonymous and signed-in views =====

  // Compact rating chip: "★ 4.6 (12)" or "New" if no reviews yet
  const RatingChip = ({ dish, size = 11 }: { dish: { avg_rating?: number | string | null; review_count?: number }; size?: number }) => {
    const count = dish.review_count || 0;
    if (count === 0) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: `500 ${size}px ${font.sans}`, color: C.muted }}>
          <Star size={size + 1} strokeWidth={2.2} /> New
        </span>
      );
    }
    const avg = Number(dish.avg_rating || 0).toFixed(1);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, font: `500 ${size}px ${font.sans}`, color: C.ink }}>
        <Star size={size + 1} fill={C.gold} color={C.gold} /> {avg} <span style={{ color: C.muted, fontWeight: 400 }}>({count})</span>
      </span>
    );
  };

  // Static stars display for review rows
  const StarsDisplay = ({ rating, size = 13 }: { rating: number; size?: number }) => (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          fill={n <= rating ? C.gold : 'none'}
          color={n <= rating ? C.gold : C.mutedLight}
          strokeWidth={2}
        />
      ))}
    </span>
  );

  // Photo tile: uses real photo_url if present, else emoji on the striped placeholder
  const PhotoTile = ({ dish, height, radius }: { dish: { photo_url: string | null; emoji: string; name: string }, height: number | string, radius: number }) => {
    if (dish.photo_url) {
      return (
        <div style={{
          width: '100%',
          height,
          borderRadius: radius,
          backgroundImage: `url(${dish.photo_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
      );
    }
    return (
      <div style={{
        width: '100%',
        height,
        borderRadius: radius,
        background: 'repeating-linear-gradient(45deg,#ece3d5,#ece3d5 9px,#f2ebde 9px,#f2ebde 18px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40,
      }}>{dish.emoji}</div>
    );
  };

  // ANONYMOUS BROWSING: if no signed-in user, show the Discover feed with the same
  // hero + map + list experience — just gated actions (order/message/become seller).
  if (!user) {
    const anonHeroDish = dishes[0] || null;
    const anonOtherDishes = dishes.slice(anonHeroDish ? 1 : 0);
    const anonPins = dishes
      .filter(d => d.seller_latitude != null && d.seller_longitude != null)
      .map(d => ({
        id: d.id,
        lat: d.seller_latitude!,
        lng: d.seller_longitude!,
        photoUrl: d.photo_url,
        emoji: d.emoji,
        label: `$${Number(d.price).toFixed(0)}`,
      }));

    return (
      <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
        <div style={{ maxWidth: 430, margin: '0 auto', background: C.surface, minHeight: '100vh', position: 'relative', paddingBottom: 60 }}>
          {/* Header */}
          <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ font: `500 25px/1 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>Plates</div>
            <SignInButton mode="modal">
              <button style={{ background: C.terracotta, color: '#fff', padding: '8px 14px', borderRadius: 20, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogIn size={14} /> Sign in
              </button>
            </SignInButton>
          </div>
          <div style={{ padding: '0 20px 10px', font: `400 13px/1.4 ${font.sans}`, color: C.inkSoft }}>
            Homemade meals from cooks in your neighborhood. Order online, pick up nearby.
          </div>
          {/* Search bar (display only for anonymous — sign in prompt on interact) */}
          <div style={{ padding: '12px 20px 0' }}>
            <SignInButton mode="modal">
              <div style={{ cursor: 'pointer', background: '#fff', borderRadius: 14, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10, color: C.muted, font: `400 13.5px ${font.sans}`, boxShadow: '0 2px 10px rgba(60,40,20,.06)' }}>
                <Search size={15} color={C.terracotta} strokeWidth={2.5} />
                Search dishes, cooks, cuisines…
              </div>
            </SignInButton>
          </div>

          {/* Hero: Cook of the day */}
          {anonHeroDish && (
            <div style={{ padding: '16px 20px 0' }}>
              <SignInButton mode="modal">
                <div style={{ cursor: 'pointer', position: 'relative', borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 22px rgba(60,40,20,.16)' }}>
                  <PhotoTile dish={anonHeroDish} height={224} radius={0} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0) 36%,rgba(30,15,5,.76))' }} />
                  <div style={{ position: 'absolute', top: 13, left: 13, background: C.terracotta, color: '#fff', padding: '6px 11px', borderRadius: 20, font: `500 10px ${font.sans}`, letterSpacing: '.06em' }}>COOK OF THE DAY</div>
                  <div style={{ position: 'absolute', left: 16, right: 16, bottom: 15, color: '#fff' }}>
                    <div style={{ font: `500 22px/1.08 ${font.serif}` }}>{anonHeroDish.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, font: `400 12.5px ${font.sans}`, opacity: .95 }}>
                      {anonHeroDish.seller_photo_url ? (
                        <span style={{ width: 23, height: 23, borderRadius: '50%', backgroundImage: `url(${anonHeroDish.seller_photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      ) : (
                        <span style={{ width: 23, height: 23, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 10px ${font.sans}` }}>{anonHeroDish.seller_avatar}</span>
                      )}
                      {anonHeroDish.seller_name}
                      {(anonHeroDish.review_count ?? 0) > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          · <Star size={12} fill={C.gold} color={C.gold} /> {Number(anonHeroDish.avg_rating || 0).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </SignInButton>
            </div>
          )}

          {/* List / Map toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 12px' }}>
            <div style={{ font: `500 19px/1 ${font.serif}`, color: C.ink }}>Fresh from the block</div>
            <div style={{ display: 'flex', gap: 4, background: C.cardAlt, padding: 3, borderRadius: 20 }}>
              <button onClick={() => setFeedView('list')} style={{ padding: '5px 12px', borderRadius: 16, background: feedView === 'list' ? C.ink : 'transparent', color: feedView === 'list' ? '#fff' : C.inkSoft, font: `500 11px ${font.sans}` }}>
                List
              </button>
              <button onClick={() => setFeedView('map')} style={{ padding: '5px 12px', borderRadius: 16, background: feedView === 'map' ? C.ink : 'transparent', color: feedView === 'map' ? '#fff' : C.inkSoft, font: `500 11px ${font.sans}` }}>
                Map
              </button>
            </div>
          </div>

          {/* Map or list */}
          {feedView === 'map' ? (
            <div style={{ padding: '0 20px 8px' }}>
              <MapView
                height={380}
                radius={18}
                userLat={null}
                userLng={null}
                pins={anonPins}
              />
              {anonPins.length === 0 && dishes.length > 0 && (
                <div style={{ marginTop: 10, padding: 12, background: C.card, borderRadius: 12, font: `400 12px ${font.sans}`, color: C.muted, textAlign: 'center' }}>
                  Cooks haven&apos;t shared their locations yet.
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {anonOtherDishes.map(dish => (
                <SignInButton mode="modal" key={dish.id}>
                  <div style={{ cursor: 'pointer', background: C.card, borderRadius: 18, overflow: 'hidden', boxShadow: '0 3px 12px rgba(60,40,20,.07)', display: 'flex', gap: 13, padding: 11 }}>
                    <div style={{ width: 96, height: 96, borderRadius: 13, overflow: 'hidden', flex: 'none' }}>
                      <PhotoTile dish={dish} height={96} radius={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ font: `500 16px/1.12 ${font.serif}`, color: C.ink }}>{dish.name}</div>
                        <div style={{ font: `500 16px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(dish.price).toFixed(0)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, color: C.muted, font: `400 12px ${font.sans}` }}>
                        {dish.seller_photo_url ? (
                          <span style={{ width: 17, height: 17, borderRadius: '50%', backgroundImage: `url(${dish.seller_photo_url})`, backgroundSize: 'cover' }} />
                        ) : (
                          <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 9px ${font.sans}` }}>{dish.seller_avatar}</span>
                        )}
                        {dish.seller_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                        <RatingChip dish={dish} size={11} />
                        <span style={{ background: C.terracottaLight, color: C.terracotta, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>♥ {dish.likes}</span>
                      </div>
                    </div>
                  </div>
                </SignInButton>
              ))}
              {dishes.length === 0 && (
                <div style={{ padding: '30px 24px', textAlign: 'center', color: C.muted, font: `400 13px ${font.sans}` }}>
                  No dishes to show yet.
                </div>
              )}
            </div>
          )}

          {feedView === 'list' && dishHasMore && (
            <div style={{ padding: '4px 20px 8px' }}>
              <button
                onClick={loadMoreDishes}
                disabled={loadingMoreDishes}
                style={{ width: '100%', padding: 13, background: C.cardAlt, color: C.inkSoft, borderRadius: 12, font: `500 13px ${font.sans}` }}
              >
                {loadingMoreDishes ? 'Loading…' : 'Load more dishes'}
              </button>
            </div>
          )}

          <div style={{ padding: '24px 20px 12px', textAlign: 'center', color: C.muted, font: `400 12.5px ${font.sans}` }}>
            Sign in to order, save favorites, and become a cook.
          </div>

          {/* Legal footer */}
          <div style={{ padding: '0 20px 20px', display: 'flex', gap: 14, justifyContent: 'center', font: `400 11.5px ${font.sans}`, color: C.muted }}>
            <a href="/terms" style={{ color: C.muted, textDecoration: 'none' }}>Terms</a>
            <span>·</span>
            <a href="/privacy" style={{ color: C.muted, textDecoration: 'none' }}>Privacy</a>
            <span>·</span>
            <span>© Plates {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    );
  }

  // Available dietary tags and filtering — already computed above with hooks in the right order.
  // Just derive display-only values here.
  const heroDish = isFiltering ? null : (dishes[0] || null);
  const otherDishes = isFiltering ? filteredDishes : dishes.slice(heroDish ? 1 : 0);

  const clearFilters = () => {
    setDistanceFilter('any');
    setDietaryFilter([]);
    setRatingFilter('any');
  };

  const toggleDietaryTag = (tag: string) => {
    setDietaryFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const statusLabels: Record<OrderStatus, string> = {
    placed: 'Order placed',
    accepted: 'Cook accepted',
    cooking: 'Cooking',
    ready: 'Ready for pickup',
    picked_up: 'Picked up',
    cancelled: 'Cancelled',
  };

  const statusColors: Record<OrderStatus, string> = {
    placed: C.terracotta,
    accepted: C.terracotta,
    cooking: '#e6944c',
    ready: C.green,
    picked_up: C.muted,
    cancelled: '#c94b4b',
  };

  const activeCount = orders.filter(o => o.status !== 'picked_up' && o.status !== 'cancelled').length;
  const cookActiveCount = cookOrders.filter(o => o.status !== 'picked_up' && o.status !== 'cancelled').length;

  const timeAgo = (iso: string): string => {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const mins = Math.max(0, Math.round((now - then) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    return `${days}d ago`;
  };

  // Format a pickup timestamp as "6:47 PM · in 32 min" or "6:47 PM · overdue by 5 min"
  const formatPickupAt = (iso: string | null): { clock: string; relative: string; overdue: boolean } | null => {
    if (!iso) return null;
    const t = new Date(iso);
    const hh = t.getHours();
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const displayH = hh % 12 === 0 ? 12 : hh % 12;
    const clock = `${displayH}:${mm} ${ampm}`;
    const diffMin = Math.round((t.getTime() - Date.now()) / 60000);
    if (diffMin > 0) {
      const relative = diffMin < 60 ? `in ${diffMin} min` : `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
      return { clock, relative, overdue: false };
    }
    if (diffMin === 0) return { clock, relative: 'now', overdue: false };
    const late = Math.abs(diffMin);
    const relative = late < 60 ? `${late} min ago` : `${Math.floor(late / 60)}h ${late % 60}m ago`;
    return { clock, relative, overdue: true };
  };

  const needsTermsAcceptance = user && user.terms_accepted_at == null;

  return (
    <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
      <div style={{ maxWidth: 430, margin: '0 auto', background: C.surface, minHeight: '100vh', position: 'relative' }}>

        {/* ================= TERMS ACCEPTANCE MODAL (blocking) ================= */}
        {needsTermsAcceptance && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,15,5,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
            <div style={{ background: C.card, borderRadius: 20, padding: '24px 22px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink, marginBottom: 8 }}>Welcome to Plates</div>
              <div style={{ font: `400 14px/1.5 ${font.sans}`, color: C.inkSoft, marginBottom: 18 }}>
                Before you get started, please review and accept our Terms of Service and Privacy Policy.
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 10, background: C.surface, border: `1px solid ${C.divider}`, borderRadius: 10, textAlign: 'center', font: `500 12.5px ${font.sans}`, color: C.terracotta, textDecoration: 'none' }}>
                  Read Terms →
                </a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: 10, background: C.surface, border: `1px solid ${C.divider}`, borderRadius: 10, textAlign: 'center', font: `500 12.5px ${font.sans}`, color: C.terracotta, textDecoration: 'none' }}>
                  Read Privacy →
                </a>
              </div>

              <label
                onClick={() => setTermsChecked(!termsChecked)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, background: termsChecked ? C.greenLight : C.surface, borderRadius: 12, marginBottom: 16, border: `2px solid ${termsChecked ? C.green : 'transparent'}` }}
              >
                <div style={{ width: 22, height: 22, borderRadius: 6, background: termsChecked ? C.green : '#fff', border: `2px solid ${termsChecked ? C.green : C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff', font: `700 13px ${font.sans}`, marginTop: 1 }}>
                  {termsChecked ? '✓' : ''}
                </div>
                <div style={{ font: `500 13px/1.4 ${font.sans}`, color: termsChecked ? C.green : C.ink }}>
                  I agree to the Plates Terms of Service and Privacy Policy.
                </div>
              </label>

              <button
                onClick={handleAcceptTerms}
                disabled={!termsChecked || termsSubmitting}
                style={{ width: '100%', padding: 14, background: (termsChecked && !termsSubmitting) ? C.terracotta : C.cardAlt, color: (termsChecked && !termsSubmitting) ? '#fff' : C.mutedLight, borderRadius: 12, font: `500 14px ${font.sans}` }}
              >
                {termsSubmitting ? 'Saving…' : 'Continue'}
              </button>
              <div style={{ font: `400 10.5px ${font.sans}`, color: C.muted, textAlign: 'center', marginTop: 10 }}>
                You must accept to use Plates.
              </div>
            </div>
          </div>
        )}

        {/* ================= DISCOVER ================= */}
        {screen === 'feed' && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ font: `500 25px/1 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>Plates</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {user.latitude != null && (
                  <button
                    onClick={() => setShowNearbyPanel(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.cardAlt, padding: '7px 11px', borderRadius: 20, font: `500 12px ${font.sans}`, color: C.inkSoft }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                    Within {nearbyRadiusMi < 1 ? nearbyRadiusMi.toFixed(1) : Math.round(nearbyRadiusMi)} mi ▾
                  </button>
                )}
                {user.role === 'admin' && (
                  <button onClick={() => setScreen('admin')} style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: (adminStats && adminStats.pending > 0) ? C.terracotta : C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: (adminStats && adminStats.pending > 0) ? '#fff' : C.inkSoft }}>
                    <Shield size={17} />
                    {adminStats && adminStats.pending > 0 && (
                      <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#fff', color: C.terracotta, font: `700 10px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.terracotta}` }}>{adminStats.pending}</span>
                    )}
                  </button>
                )}
                <button onClick={() => setScreen('notifications')} style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft }}>
                  <Bell size={17} />
                  {notifications.length > 0 && (
                    <span style={{ position: 'absolute', top: 6, right: 7, minWidth: 14, height: 14, padding: '0 4px', borderRadius: 8, background: C.terracotta, color: '#fff', font: `500 9px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${C.surface}` }}>{notifications.length}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Discover / Feed tab toggle */}
            <div style={{ padding: '10px 20px 0', display: 'flex', gap: 24, borderBottom: `1px solid ${C.hairline}` }}>
              <button
                onClick={() => setHomeTab('discover')}
                style={{
                  padding: '10px 0',
                  background: 'transparent',
                  color: homeTab === 'discover' ? C.ink : C.muted,
                  font: `500 15px ${font.serif}`,
                  borderBottom: homeTab === 'discover' ? `2px solid ${C.terracotta}` : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                Discover
              </button>
              <button
                onClick={() => setHomeTab('feed')}
                style={{
                  padding: '10px 0',
                  background: 'transparent',
                  color: homeTab === 'feed' ? C.ink : C.muted,
                  font: `500 15px ${font.serif}`,
                  borderBottom: homeTab === 'feed' ? `2px solid ${C.terracotta}` : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                Feed
              </button>
            </div>

            {homeTab === 'discover' && (<>
              <div style={{ padding: '12px 20px 0' }}>
                <div style={{ background: '#fff', borderRadius: 14, padding: '10px 15px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 10px rgba(60,40,20,.06)' }}>
                  <Search size={15} color={C.terracotta} strokeWidth={2.5} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes or cooks…"
                    style={{ flex: 1, border: 'none', outline: 'none', font: `400 13.5px ${font.sans}`, background: 'transparent', color: C.ink, minWidth: 0 }}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ color: C.muted, padding: 2, display: 'flex' }}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter chips */}
              <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                <button
                  onClick={() => setShowFilterPanel(true)}
                  style={{
                    flex: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
                    background: activeFilterCount > 0 ? C.ink : C.card,
                    color: activeFilterCount > 0 ? '#fff' : C.inkSoft,
                    border: `1px solid ${activeFilterCount > 0 ? C.ink : C.divider}`,
                    borderRadius: 16, font: `500 11.5px ${font.sans}`, whiteSpace: 'nowrap'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 8, background: '#fff', color: C.ink, font: `700 10px ${font.sans}`, padding: '0 4px' }}>{activeFilterCount}</span>
                  )}
                </button>

                {distanceFilter !== 'any' && (
                  <button onClick={() => setDistanceFilter('any')} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: C.terracotta, color: '#fff', border: `1px solid ${C.terracotta}`, borderRadius: 16, font: `500 11.5px ${font.sans}`, whiteSpace: 'nowrap' }}>
                    Within {distanceFilter === '1mi' ? '1 mi' : distanceFilter === '3mi' ? '3 mi' : '5 mi'}
                    <X size={11} />
                  </button>
                )}
                {ratingFilter !== 'any' && (
                  <button onClick={() => setRatingFilter('any')} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: C.terracotta, color: '#fff', border: `1px solid ${C.terracotta}`, borderRadius: 16, font: `500 11.5px ${font.sans}`, whiteSpace: 'nowrap' }}>
                    {ratingFilter === '4plus' ? '4+ stars' : '4.5+ stars'}
                    <X size={11} />
                  </button>
                )}
                {dietaryFilter.map(tag => (
                  <button key={tag} onClick={() => toggleDietaryTag(tag)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', background: C.terracotta, color: '#fff', border: `1px solid ${C.terracotta}`, borderRadius: 16, font: `500 11.5px ${font.sans}`, whiteSpace: 'nowrap' }}>
                    {tag}
                    <X size={11} />
                  </button>
                ))}
              </div>

              {isFiltering && (
                <div style={{ padding: '10px 20px 0', font: `400 12px ${font.sans}`, color: C.muted }}>
                  {filteredDishes.length === 0 ? 'No dishes match' : `${filteredDishes.length} result${filteredDishes.length === 1 ? '' : 's'}`}
                </div>
              )}

              {heroDish && (
                <div style={{ padding: '16px 20px 0' }}>
                  <div onClick={() => openMeal(heroDish)} style={{ cursor: 'pointer', position: 'relative', borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 22px rgba(60,40,20,.16)' }}>
                    <PhotoTile dish={heroDish} height={224} radius={0} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,0) 36%,rgba(30,15,5,.76))' }} />
                    <div style={{ position: 'absolute', top: 13, left: 13, background: C.terracotta, color: '#fff', padding: '6px 11px', borderRadius: 20, font: `500 10px ${font.sans}`, letterSpacing: '.06em' }}>COOK OF THE DAY</div>
                    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 15, color: '#fff' }}>
                      <div style={{ font: `500 22px/1.08 ${font.serif}` }}>{heroDish.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, font: `400 12.5px ${font.sans}`, opacity: .95 }}>
                        {heroDish.seller_photo_url ? (
                          <span style={{ width: 23, height: 23, borderRadius: '50%', backgroundImage: `url(${heroDish.seller_photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        ) : (
                          <span style={{ width: 23, height: 23, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 10px ${font.sans}` }}>{heroDish.seller_avatar}</span>
                        )}
                        {heroDish.seller_name}
                        {(heroDish.review_count ?? 0) > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            · <Star size={12} fill={C.gold} color={C.gold} /> {Number(heroDish.avg_rating || 0).toFixed(1)}
                          </span>
                        )}
                        {user.latitude != null && heroDish.seller_latitude != null && heroDish.seller_longitude != null && user.longitude != null && (
                          <> · {distanceMiles(user.latitude, user.longitude, heroDish.seller_latitude, heroDish.seller_longitude).toFixed(1)} mi</>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 12px' }}>
                <div style={{ font: `500 19px/1 ${font.serif}`, color: C.ink }}>{isFiltering ? 'Results' : 'Fresh from the block'}</div>
                <div style={{ display: 'flex', gap: 4, background: C.cardAlt, padding: 3, borderRadius: 20 }}>
                  <button onClick={() => setFeedView('list')} style={{ padding: '5px 12px', borderRadius: 16, background: feedView === 'list' ? C.ink : 'transparent', color: feedView === 'list' ? '#fff' : C.inkSoft, font: `500 11px ${font.sans}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                    List
                  </button>
                  <button onClick={() => setFeedView('map')} style={{ padding: '5px 12px', borderRadius: 16, background: feedView === 'map' ? C.ink : 'transparent', color: feedView === 'map' ? '#fff' : C.inkSoft, font: `500 11px ${font.sans}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                    Map
                  </button>
                </div>
              </div>

              {dishes.length === 0 && (
                <div style={{ padding: '0 20px 8px', font: `400 12px ${font.sans}`, color: C.muted }}>No dishes yet</div>
              )}
              {isFiltering && filteredDishes.length === 0 && dishes.length > 0 && (
                <div style={{ padding: '30px 24px', textAlign: 'center' }}>
                  <Search size={30} color={C.muted} style={{ opacity: .4, marginBottom: 10 }} />
                  <div style={{ font: `500 14px ${font.serif}`, color: C.ink, marginBottom: 4 }}>No matches</div>
                  <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 12 }}>Try different keywords or clear a filter.</div>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} style={{ padding: '8px 16px', background: C.terracotta, color: '#fff', borderRadius: 20, font: `500 12.5px ${font.sans}` }}>
                      Clear filters
                    </button>
                  )}
                </div>
              )}

              {feedView === 'map' ? (
                <div style={{ padding: '0 20px 8px' }}>
                  <MapView
                    height={380}
                    radius={18}
                    userLat={user.latitude}
                    userLng={user.longitude}
                    pins={(isFiltering ? filteredDishes : dishes)
                      .filter(d => d.seller_latitude != null && d.seller_longitude != null)
                      .map(d => ({
                        id: d.id,
                        lat: d.seller_latitude!,
                        lng: d.seller_longitude!,
                        photoUrl: d.photo_url,
                        emoji: d.emoji,
                        label: `$${Number(d.price).toFixed(0)}`,
                        onClick: () => openMeal(d),
                      }))}
                  />
                  {(isFiltering ? filteredDishes : dishes).filter(d => d.seller_latitude != null).length === 0 && dishes.length > 0 && (
                    <div style={{ marginTop: 10, padding: 12, background: C.card, borderRadius: 12, font: `400 12px ${font.sans}`, color: C.muted, textAlign: 'center' }}>
                      {isFiltering ? 'No dishes match your filters on the map.' : 'No cooks have shared a location yet. Ask cooks to enable location in their kitchen setup.'}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '0 20px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {otherDishes.map(dish => {
                    const dist = (user.latitude != null && user.longitude != null && dish.seller_latitude != null && dish.seller_longitude != null)
                      ? distanceMiles(user.latitude, user.longitude, dish.seller_latitude, dish.seller_longitude)
                      : null;
                    return (
                      <div key={dish.id} onClick={() => openMeal(dish)} style={{ cursor: 'pointer', background: C.card, borderRadius: 18, overflow: 'hidden', boxShadow: '0 3px 12px rgba(60,40,20,.07)', display: 'flex', gap: 13, padding: 11 }}>
                        <div style={{ width: 96, height: 96, borderRadius: 13, overflow: 'hidden', flex: 'none' }}>
                          <PhotoTile dish={dish} height={96} radius={13} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ font: `500 16px/1.12 ${font.serif}`, color: C.ink }}>{dish.name}</div>
                            <div style={{ font: `500 16px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(dish.price).toFixed(0)}</div>
                          </div>
                          <a
                            href={`/cook/${dish.seller_id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, color: C.muted, font: `400 12px ${font.sans}`, textDecoration: 'none' }}
                          >
                            {dish.seller_photo_url ? (
                              <span style={{ width: 17, height: 17, borderRadius: '50%', backgroundImage: `url(${dish.seller_photo_url})`, backgroundSize: 'cover' }} />
                            ) : (
                              <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 9px ${font.sans}` }}>{dish.seller_avatar}</span>
                            )}
                            <span style={{ textDecoration: 'underline', textDecorationColor: 'transparent' }}>{dish.seller_name}</span>
                          </a>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                            {dist !== null && (
                              <span style={{ background: C.greenLight, color: C.green, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>{dist < 0.1 ? 'nearby' : `~${dist.toFixed(1)} mi`}</span>
                            )}
                            {dish.seller_kitchen_environment && (
                              <span style={{ background: C.cardAlt, color: C.inkSoft, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>{dish.seller_kitchen_environment}</span>
                            )}
                            <RatingChip dish={dish} size={11} />
                            <span style={{ background: C.terracottaLight, color: C.terracotta, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>♥ {dish.likes}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {feedView === 'list' && searchQuery.trim() && searchHasMore && (
                <div style={{ padding: '4px 20px 8px' }}>
                  <button
                    onClick={loadMoreSearch}
                    disabled={searchLoading}
                    style={{ width: '100%', padding: 13, background: C.cardAlt, color: C.inkSoft, borderRadius: 12, font: `500 13px ${font.sans}` }}
                  >
                    {searchLoading ? 'Loading…' : 'Load more results'}
                  </button>
                </div>
              )}
              {feedView === 'list' && !searchQuery.trim() && activeFilterCount === 0 && dishHasMore && (
                <div style={{ padding: '4px 20px 8px' }}>
                  <button
                    onClick={loadMoreDishes}
                    disabled={loadingMoreDishes}
                    style={{ width: '100%', padding: 13, background: C.cardAlt, color: C.inkSoft, borderRadius: 12, font: `500 13px ${font.sans}` }}
                  >
                    {loadingMoreDishes ? 'Loading…' : 'Load more dishes'}
                  </button>
                </div>
              )}

              <div style={{ padding: '18px 20px 26px' }}>
                {user && user.seller_status === 'approved' ? (
                  <div onClick={() => setScreen('seller-dashboard')} style={{ cursor: 'pointer', background: C.green, borderRadius: 20, padding: '17px 18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ font: `500 16px/1.1 ${font.serif}` }}>Your kitchen</div>
                      <div style={{ font: `400 12px ${font.sans}`, opacity: .85, marginTop: 4 }}>Manage your plates and orders.</div>
                    </div>
                    <div style={{ background: '#fff', color: C.green, padding: '10px 15px', borderRadius: 13, font: `500 12.5px ${font.sans}` }}>Open</div>
                  </div>
                ) : (
                  <div onClick={toggleSellerMode} style={{ cursor: 'pointer', background: C.green, borderRadius: 20, padding: '17px 18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ font: `500 16px/1.1 ${font.serif}` }}>Are you a home cook?</div>
                      <div style={{ font: `400 12px ${font.sans}`, opacity: .85, marginTop: 4 }}>Post today's plate in minutes.</div>
                    </div>
                    <div style={{ background: '#fff', color: C.green, padding: '10px 15px', borderRadius: 13, font: `500 12.5px ${font.sans}` }}>Start cooking</div>
                  </div>
                )}
              </div>

              {/* Legal footer */}
              <div style={{ padding: '0 20px 20px', display: 'flex', gap: 14, justifyContent: 'center', font: `400 11.5px ${font.sans}`, color: C.muted }}>
                <a href="/terms" style={{ color: C.muted, textDecoration: 'none' }}>Terms</a>
                <span>·</span>
                <a href="/privacy" style={{ color: C.muted, textDecoration: 'none' }}>Privacy</a>
                <span>·</span>
                <span>© Plates {new Date().getFullYear()}</span>
              </div>
            </>)}

            {/* ================= COMMUNITY FEED (inside Discover screen) ================= */}
            {homeTab === 'feed' && (
              <div style={{ padding: '0 0 20px' }}>
                {/* Proximity control row */}
                <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => {
                      if (feedLocationStatus === 'denied') {
                        // User previously blocked location; try again
                        requestFeedLocation();
                      } else {
                        setShowRadiusPanel(true);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px',
                      background: feedLat != null ? C.ink : C.cardAlt,
                      color: feedLat != null ? '#fff' : C.inkSoft,
                      borderRadius: 20,
                      font: `500 12px ${font.sans}`,
                    }}
                  >
                    <MapPin size={13} />
                    {feedLocationStatus === 'requesting' && 'Locating…'}
                    {feedLocationStatus === 'granted' && `Within ${feedRadiusMi < 1 ? feedRadiusMi.toFixed(1) : Math.round(feedRadiusMi)} mi`}
                    {feedLocationStatus === 'denied' && 'Enable location'}
                    {feedLocationStatus === 'unknown' && 'Set location'}
                  </button>
                  {feedLocationStatus === 'denied' && (
                    <span style={{ font: `400 11px ${font.sans}`, color: C.muted }}>
                      Showing all posts globally
                    </span>
                  )}
                  {feedLocationStatus === 'granted' && (
                    <span style={{ font: `400 11px ${font.sans}`, color: C.muted }}>
                      {posts.length} nearby
                    </span>
                  )}
                </div>

                {/* Composer */}
                <div style={{ padding: '14px 20px 0' }}>
                  <div style={{ background: C.card, borderRadius: 16, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {user.photo_url ? (
                        <span style={{ width: 36, height: 36, borderRadius: '50%', backgroundImage: `url(${user.photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
                      ) : (
                        <span style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 13px ${font.sans}`, flex: 'none' }}>{user.avatar}</span>
                      )}
                      <textarea
                        value={composerText}
                        onChange={(e) => setComposerText(e.target.value)}
                        placeholder="What are you cooking today?"
                        rows={2}
                        maxLength={500}
                        style={{ flex: 1, border: 'none', outline: 'none', font: `400 14px/1.4 ${font.sans}`, background: 'transparent', resize: 'none' }}
                      />
                    </div>
                    {composerPhoto && (
                      <div style={{ position: 'relative', marginTop: 10 }}>
                        <img src={composerPhoto} alt="preview" style={{ width: '100%', borderRadius: 12, maxHeight: 300, objectFit: 'cover' }} />
                        <button
                          onClick={() => { setComposerPhoto(null); setComposerPhotoName(null); }}
                          style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, background: 'rgba(0,0,0,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                      <button
                        onClick={() => composerFileInputRef.current?.click()}
                        style={{ padding: '6px 10px', background: C.surface, color: C.inkSoft, borderRadius: 10, font: `500 12px ${font.sans}`, display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Camera size={14} /> {composerPhoto ? 'Change photo' : 'Add photo'}
                      </button>
                      <input ref={composerFileInputRef} type="file" accept="image/*" onChange={handleComposerPhotoChange} style={{ display: 'none' }} />
                      <div style={{ flex: 1, font: `400 11px ${font.sans}`, color: C.muted }}>
                        {composerText.length}/500 · posts vanish after 24hr
                      </div>
                      <button
                        onClick={publishPost}
                        disabled={!composerText.trim() || composerPosting}
                        style={{ padding: '8px 16px', background: composerText.trim() && !composerPosting ? C.terracotta : C.cardAlt, color: composerText.trim() && !composerPosting ? '#fff' : C.mutedLight, borderRadius: 20, font: `500 12.5px ${font.sans}` }}
                      >
                        {composerPosting ? 'Posting…' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Feed */}
                <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {posts.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: C.muted }}>
                      <ChefHat size={30} style={{ opacity: .4, marginBottom: 10 }} />
                      <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>
                        {feedLocationStatus === 'granted' ? `No posts within ${feedRadiusMi < 1 ? feedRadiusMi.toFixed(1) : Math.round(feedRadiusMi)} mi` : 'The feed is quiet'}
                      </div>
                      <div style={{ font: `400 12px ${font.sans}`, marginTop: 4 }}>
                        {feedLocationStatus === 'granted' ? 'Try expanding your radius or check back later.' : "Be the first to share what you're making today."}
                      </div>
                      {feedLocationStatus === 'granted' && (
                        <button
                          onClick={() => setShowRadiusPanel(true)}
                          style={{ marginTop: 12, padding: '8px 14px', background: C.terracotta, color: '#fff', borderRadius: 20, font: `500 12.5px ${font.sans}` }}
                        >
                          Expand radius
                        </button>
                      )}
                    </div>
                  ) : (
                    posts.map(p => {
                      const isMine = p.user_id === user.id;
                      const canModerate = isMine || user.role === 'admin';
                      const isCook = p.author_seller_status === 'approved';
                      const isExpanded = expandedCommentsFor === p.id;
                      const comments = postComments[p.id] || [];

                      const ReactionBtn = ({ kind, count, label, emoji }: { kind: 'heart' | 'fire' | 'hands'; count: number; label: string; emoji: string }) => {
                        const active = p.viewer_reactions.includes(kind);
                        return (
                          <button
                            onClick={() => reactToPost(p.id, kind)}
                            aria-label={label}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '5px 10px',
                              background: active ? C.terracottaLight : C.surface,
                              border: `1px solid ${active ? C.terracotta : C.divider}`,
                              color: active ? C.terracotta : C.inkSoft,
                              borderRadius: 20,
                              font: `500 12px ${font.sans}`,
                            }}
                          >
                            <span style={{ fontSize: 14, lineHeight: 1 }}>{emoji}</span>
                            {count > 0 && <span>{count}</span>}
                          </button>
                        );
                      };

                      return (
                        <div key={p.id} style={{ background: C.card, borderRadius: 16, boxShadow: '0 2px 8px rgba(60,40,20,.05)', overflow: 'hidden' }}>
                          {/* Header */}
                          <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            {p.author_photo_url ? (
                              <span style={{ width: 38, height: 38, borderRadius: '50%', backgroundImage: `url(${p.author_photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
                            ) : (
                              <span style={{ width: 38, height: 38, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 14px ${font.sans}`, flex: 'none' }}>{p.author_avatar}</span>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ font: `500 13.5px ${font.serif}`, color: C.ink }}>{p.author_kitchen_name || p.author_name}</span>
                                {isCook && (
                                  <span style={{ padding: '1px 6px', background: C.greenLight, color: C.green, borderRadius: 6, font: `500 9px ${font.sans}`, letterSpacing: '.03em' }}>COOK</span>
                                )}
                              </div>
                              <div style={{ font: `400 10.5px ${font.sans}`, color: C.muted, marginTop: 1, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span>{timeAgo(p.created_at)}</span>
                                <span>·</span>
                                <span>{expiresIn(p.expires_at)}</span>
                                {p.distance_mi != null && (
                                  <>
                                    <span>·</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.terracotta, fontWeight: 500 }}>
                                      <MapPin size={9} />
                                      {p.distance_mi < 0.1 ? 'here' : p.distance_mi < 1 ? `${(p.distance_mi * 5280 / 100 | 0) * 100} ft` : `${p.distance_mi.toFixed(1)} mi`}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {canModerate && (
                              <button
                                onClick={() => deletePostAction(p.id)}
                                aria-label="Delete post"
                                style={{ padding: 6, color: C.muted }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>

                          {/* Body */}
                          <div style={{ padding: '0 14px 12px', font: `400 14px/1.4 ${font.sans}`, color: C.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {p.body}
                          </div>

                          {/* Photo */}
                          {p.photo_url && (
                            <img src={p.photo_url} alt="" style={{ width: '100%', display: 'block', maxHeight: 500, objectFit: 'cover' }} />
                          )}

                          {/* Reactions + comments row */}
                          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <ReactionBtn kind="heart" count={p.heart_count} label="Heart" emoji="❤️" />
                            <ReactionBtn kind="fire" count={p.fire_count} label="Fire" emoji="🔥" />
                            <ReactionBtn kind="hands" count={p.hands_count} label="Hands up" emoji="🙌" />
                            <div style={{ flex: 1 }} />
                            <button
                              onClick={() => toggleComments(p.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: C.surface, color: C.inkSoft, borderRadius: 20, font: `500 12px ${font.sans}`, border: `1px solid ${C.divider}` }}
                            >
                              <MessageCircle size={13} /> {p.comment_count > 0 ? p.comment_count : ''}
                            </button>
                          </div>

                          {/* Comments (expanded) */}
                          {isExpanded && (
                            <div style={{ background: C.surface, padding: '10px 14px', borderTop: `1px solid ${C.hairline}` }}>
                              {comments.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                                  {comments.map(c => (
                                    <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                      {c.author_photo_url ? (
                                        <span style={{ width: 26, height: 26, borderRadius: '50%', backgroundImage: `url(${c.author_photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
                                      ) : (
                                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 10px ${font.sans}`, flex: 'none' }}>{c.author_avatar}</span>
                                      )}
                                      <div style={{ flex: 1, background: C.card, borderRadius: 10, padding: '6px 10px', minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                                          <span style={{ font: `500 11.5px ${font.sans}`, color: C.ink }}>{c.author_name}</span>
                                          {(c.user_id === user.id || user.role === 'admin') && (
                                            <button
                                              onClick={() => deleteCommentAction(p.id, c.id)}
                                              style={{ color: C.muted, padding: 0, font: `400 10px ${font.sans}` }}
                                            >
                                              delete
                                            </button>
                                          )}
                                        </div>
                                        <div style={{ font: `400 12.5px/1.35 ${font.sans}`, color: C.inkSoft, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
                                        <div style={{ font: `400 10px ${font.sans}`, color: C.muted, marginTop: 2 }}>{timeAgo(c.created_at)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 10 }}>
                                  No comments yet. Say something nice.
                                </div>
                              )}
                              {/* Comment composer */}
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={commentDraft[p.id] || ''}
                                  onChange={(e) => setCommentDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      publishComment(p.id);
                                    }
                                  }}
                                  placeholder="Add a comment…"
                                  maxLength={300}
                                  disabled={commentPosting === p.id}
                                  style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.divider}`, borderRadius: 18, font: `400 12.5px ${font.sans}`, background: C.card, outline: 'none' }}
                                />
                                <button
                                  onClick={() => publishComment(p.id)}
                                  disabled={!(commentDraft[p.id] || '').trim() || commentPosting === p.id}
                                  style={{ width: 34, height: 34, borderRadius: 17, background: (commentDraft[p.id] || '').trim() ? C.terracotta : C.cardAlt, color: (commentDraft[p.id] || '').trim() ? '#fff' : C.mutedLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
                                >
                                  <Send size={14} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= MEAL DETAIL ================= */}
        {screen === 'meal' && selectedDish && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ position: 'relative' }}>
              <PhotoTile dish={selectedDish} height={280} radius={0} />
              <button onClick={() => setScreen('feed')} style={{ position: 'absolute', top: 16, left: 16, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <button onClick={() => toggleLike(selectedDish.id)} style={{ position: 'absolute', top: 16, right: 16, width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.terracotta }}>
                <Heart size={18} fill={selectedDish.liked ? C.terracotta : 'none'} />
              </button>
            </div>

            <div style={{ padding: '20px 22px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div>
                  <div style={{ font: `500 24px/1.1 ${font.serif}`, color: C.ink }}>{selectedDish.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: C.muted, font: `400 12.5px ${font.sans}` }}>
                    {selectedDish.seller_photo_url ? (
                      <span style={{ width: 22, height: 22, borderRadius: '50%', backgroundImage: `url(${selectedDish.seller_photo_url})`, backgroundSize: 'cover' }} />
                    ) : (
                      <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 10px ${font.sans}` }}>{selectedDish.seller_avatar}</span>
                    )}
                    {selectedDish.seller_name} · <span style={{ color: C.gold }}>♥ {selectedDish.likes}</span>
                  </div>
                </div>
                <div style={{ font: `500 24px ${font.serif}`, color: C.terracotta }}>${Number(selectedDish.price).toFixed(0)}</div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                {user.latitude != null && user.longitude != null && selectedDish.seller_latitude != null && selectedDish.seller_longitude != null && (
                  <span style={{ background: C.greenLight, color: C.green, padding: '5px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>
                    ~{distanceMiles(user.latitude, user.longitude, selectedDish.seller_latitude, selectedDish.seller_longitude).toFixed(1)} mi away
                  </span>
                )}
                <span style={{ background: C.cardAlt, color: C.inkSoft, padding: '5px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>Homemade</span>
              </div>

              {selectedDish.description && (
                <div style={{ font: `400 13.5px/1.6 ${font.sans}`, color: C.inkSoft, marginTop: 18 }}>
                  {selectedDish.description}
                </div>
              )}

              <a href={`/cook/${selectedDish.seller_id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginTop: 22 }}>
                <div style={{ background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.cardAlt}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {selectedDish.seller_photo_url ? (
                      <span style={{ width: 40, height: 40, borderRadius: '50%', backgroundImage: `url(${selectedDish.seller_photo_url})`, backgroundSize: 'cover' }} />
                    ) : (
                      <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 14px ${font.sans}` }}>{selectedDish.seller_avatar}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ font: `500 14px ${font.sans}`, color: C.ink }}>{selectedDish.seller_name}</div>
                      <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>
                        {selectedDish.seller_cooking_hours || 'Home cook'}
                      </div>
                    </div>
                    <div style={{ font: `500 11px ${font.sans}`, color: C.terracotta, whiteSpace: 'nowrap' }}>View profile →</div>
                  </div>
                  {(selectedDish.seller_kitchen_environment || selectedDish.seller_kitchen_flags) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                      {selectedDish.seller_kitchen_environment && (
                        <span style={{ background: C.greenLight, color: C.green, padding: '4px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>
                          {selectedDish.seller_kitchen_environment}
                        </span>
                      )}
                      {selectedDish.seller_kitchen_flags && selectedDish.seller_kitchen_flags.split(',').map(f => f.trim()).filter(Boolean).map(flag => (
                        <span key={flag} style={{ background: C.surface, color: C.inkSoft, padding: '4px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>
                          {flag.charAt(0).toUpperCase() + flag.slice(1).replace('-', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  {selectedDish.seller_pickup_description && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: C.surface, borderRadius: 10, font: `400 12.5px ${font.sans}`, color: C.inkSoft }}>
                      <span style={{ color: C.muted }}>Pickup: </span>{selectedDish.seller_pickup_description}
                    </div>
                  )}
                </div>
              </a>

              {selectedDish.seller_latitude != null && selectedDish.seller_longitude != null && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ font: `500 14px ${font.serif}`, color: C.ink, marginBottom: 10 }}>Pickup location</div>
                  <MapView
                    height={220}
                    radius={14}
                    centerLat={selectedDish.seller_latitude}
                    centerLng={selectedDish.seller_longitude}
                    userLat={user.latitude}
                    userLng={user.longitude}
                    pins={[{
                      id: selectedDish.id,
                      lat: selectedDish.seller_latitude,
                      lng: selectedDish.seller_longitude,
                      photoUrl: selectedDish.photo_url,
                      emoji: selectedDish.emoji,
                    }]}
                    zoom={showingDirections ? 12 : 14}
                    interactive={showingDirections}
                    showDirections={showingDirections}
                    onDirectionsReady={setTripInfo}
                  />
                  {showingDirections && tripInfo && (
                    <div style={{ marginTop: 10, background: C.greenLight, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Navigation size={16} color={C.green} />
                      <div style={{ flex: 1, font: `500 13px ${font.sans}`, color: C.green }}>
                        {tripInfo.durationText} · {tripInfo.distanceText} by car
                      </div>
                    </div>
                  )}
                  {user.latitude == null || user.longitude == null ? (
                    <button
                      onClick={requestLocation}
                      style={{ marginTop: 10, width: '100%', background: C.card, border: `1px solid ${C.divider}`, color: C.ink, borderRadius: 12, padding: 12, font: `500 13px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <MapPin size={15} /> Share your location to see directions
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setShowingDirections(!showingDirections);
                        if (showingDirections) setTripInfo(null);
                      }}
                      style={{ marginTop: 10, width: '100%', background: showingDirections ? C.terracottaLight : C.card, border: `1px solid ${showingDirections ? C.terracotta : C.divider}`, color: showingDirections ? C.terracotta : C.ink, borderRadius: 12, padding: 12, font: `500 13px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Navigation size={15} /> {showingDirections ? 'Hide directions' : 'Show directions'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reviews */}
            <div style={{ padding: '0 22px 110px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 10 }}>
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>Reviews</div>
                <RatingChip dish={selectedDish} size={12} />
              </div>
              {mealReviews.length === 0 ? (
                <div style={{ padding: 20, background: C.card, borderRadius: 14, textAlign: 'center', color: C.muted, font: `400 12.5px ${font.sans}` }}>
                  No reviews yet. Be the first to try it!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {mealReviews.map(r => (
                    <div key={r.id} style={{ background: C.card, borderRadius: 12, padding: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        {r.buyer_photo_url ? (
                          <span style={{ width: 28, height: 28, borderRadius: '50%', backgroundImage: `url(${r.buyer_photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
                        ) : (
                          <span style={{ width: 28, height: 28, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 11px ${font.sans}`, flex: 'none' }}>{r.buyer_avatar}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: `500 13px ${font.sans}`, color: C.ink }}>{r.buyer_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <StarsDisplay rating={r.rating} size={11} />
                            <span style={{ font: `400 10.5px ${font.sans}`, color: C.muted }}>{timeAgo(r.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      {r.comment && (
                        <div style={{ font: `400 13px/1.4 ${font.sans}`, color: C.inkSoft, marginTop: 4 }}>{r.comment}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.hairline}`, padding: '14px 22px 20px', boxShadow: '0 -6px 20px rgba(60,40,20,.07)', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 430, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: C.surface, borderRadius: 12, padding: 4 }}>
                <button onClick={() => setMealQty(Math.max(1, mealQty - 1))} style={{ width: 32, height: 32, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={16} />
                </button>
                <span style={{ font: `500 14px ${font.sans}`, color: C.ink, minWidth: 20, textAlign: 'center' }}>{mealQty}</span>
                <button onClick={() => setMealQty(mealQty + 1)} style={{ width: 32, height: 32, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={16} />
                </button>
              </div>
              <button onClick={addToCart} style={{ flex: 1, background: C.terracotta, color: '#fff', borderRadius: 13, padding: 14, font: `500 14px ${font.sans}` }}>
                Add to cart · ${(Number(selectedDish.price) * mealQty).toFixed(0)}
              </button>
            </div>
          </div>
        )}
        {/* ================= CHECKOUT PAYMENT ================= */}
        {screen === 'checkout-payment' && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setScreen('cart')}
                style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink, border: 'none', cursor: 'pointer' }}
              >
                ‹
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Payment</div>
            </div>
            <div style={{ padding: '0 22px' }}>
              <div style={{ background: C.card, borderRadius: 14, padding: 18, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                {checkoutError && (
                  <div style={{ marginBottom: 14, padding: 10, background: '#fceded', border: '1px solid #f5b8b8', borderRadius: 10, color: '#8a2a2a', fontSize: 13 }}>
                    {checkoutError}
                  </div>
                )}
                <CheckoutPayment
                  clientSecrets={checkoutSecrets}
                  totalLabel={checkoutTotalLabel}
                  onSuccess={finalizeOrder}
                  onCancel={() => setScreen('cart')}
                />
              </div>
            </div>
          </div>
        )}
        {/* ================= CART ================= */}
        {screen === 'cart' && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setScreen('feed')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Your cart</div>
            </div>

            {cart.length === 0 ? (
              <div style={{ padding: '60px 22px', textAlign: 'center', color: C.muted }}>
                <ShoppingBag size={36} style={{ opacity: .4, marginBottom: 14 }} />
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 6 }}>Your cart is empty</div>
                <div style={{ font: `400 13px ${font.sans}` }}>Browse the feed to find a plate</div>
                <button onClick={() => setScreen('feed')} style={{ marginTop: 18, background: C.terracotta, color: '#fff', borderRadius: 12, padding: '10px 20px', font: `500 13px ${font.sans}` }}>
                  Back to Discover
                </button>
              </div>
            ) : (
              <>
                <div style={{ padding: '4px 22px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cart.map(item => (
                    <div key={item.cart_item_id} style={{ background: C.card, borderRadius: 16, padding: 12, display: 'flex', gap: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                      <div style={{ width: 62, height: 62, flex: 'none' }}>
                        <PhotoTile dish={item} height={62} radius={11} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ font: `500 14px/1.15 ${font.serif}`, color: C.ink }}>{item.name}</div>
                          <div style={{ font: `500 14px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${(Number(item.price) * item.quantity).toFixed(2)}</div>
                        </div>
                        <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 4 }}>from {item.seller_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', background: C.surface, borderRadius: 9, padding: 2 }}>
                            <button onClick={() => updateCartItemQty(item.cart_item_id, item.quantity - 1)} style={{ width: 26, height: 26, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Minus size={13} />
                            </button>
                            <span style={{ font: `500 12px ${font.sans}`, color: C.ink, minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={() => updateCartItemQty(item.cart_item_id, item.quantity + 1)} style={{ width: 26, height: 26, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Plus size={13} />
                            </button>
                          </div>
                          <button onClick={() => removeFromCart(item.cart_item_id)} style={{ color: C.mutedLight, font: `400 11px ${font.sans}`, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {cart[0] && (
                  <div style={{ padding: '18px 22px 0' }}>
                    <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 8 }}>Pickup from</div>
                    <div style={{ background: C.card, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: C.greenLight, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ font: `500 13px ${font.sans}`, color: C.ink }}>{cart[0].seller_name}'s kitchen</div>
                        <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>
                          {user.latitude != null && cart[0].seller_latitude != null && user.longitude != null && cart[0].seller_longitude != null
                            ? `${distanceMiles(user.latitude, user.longitude, cart[0].seller_latitude, cart[0].seller_longitude).toFixed(1)} miles from you`
                            : 'Distance unknown'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ padding: '18px 22px 0' }}>
                  <div style={{ background: C.card, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    {(() => {
                      // Compute effective bounds: intersection of all cook bounds in cart.
                      const mins = cart.map(i => i.seller_pickup_min_minutes ?? 15);
                      const maxes = cart.map(i => i.seller_pickup_max_minutes ?? 120);
                      const effectiveMin = mins.length > 0 ? Math.max(...mins) : 15;
                      const effectiveMax = maxes.length > 0 ? Math.min(...maxes) : 120;
                      const validRange = effectiveMax > effectiveMin;
                      // Clamp the display value inline — the effect below syncs state on cart change
                      const boundedValue = validRange
                        ? Math.max(effectiveMin, Math.min(effectiveMax, pickupDurationMin))
                        : effectiveMin;
                      const cookSetBounds = cart.some(i => i.seller_pickup_min_minutes != null || i.seller_pickup_max_minutes != null);
                      return (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft }}>Pick up in</div>
                            <div style={{ font: `500 12px ${font.sans}`, color: C.muted }}>
                              {(() => {
                                const t = new Date(Date.now() + boundedValue * 60_000);
                                const hh = t.getHours();
                                const mm = String(t.getMinutes()).padStart(2, '0');
                                const ampm = hh >= 12 ? 'PM' : 'AM';
                                const displayH = hh % 12 === 0 ? 12 : hh % 12;
                                return `~${displayH}:${mm} ${ampm}`;
                              })()}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                            <div style={{ font: `600 32px ${font.serif}`, color: C.terracotta, lineHeight: 1 }}>
                              {boundedValue < 60 ? boundedValue : `${Math.floor(boundedValue / 60)}h${boundedValue % 60 ? ' ' + (boundedValue % 60) + 'm' : ''}`}
                            </div>
                            {boundedValue < 60 && <div style={{ font: `500 14px ${font.sans}`, color: C.muted }}>minutes</div>}
                          </div>
                          <input
                            type="range"
                            min={effectiveMin}
                            max={effectiveMax}
                            step={5}
                            value={boundedValue}
                            onChange={(e) => setPickupDurationMin(parseInt(e.target.value))}
                            disabled={!validRange}
                            style={{ width: '100%', accentColor: C.terracotta }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, font: `400 10.5px ${font.sans}`, color: C.muted }}>
                            <span>{effectiveMin < 60 ? `${effectiveMin} min` : `${Math.floor(effectiveMin / 60)}h`}</span>
                            <span>{effectiveMax < 60 ? `${effectiveMax} min` : `${Math.floor(effectiveMax / 60)}h${effectiveMax % 60 ? (effectiveMax % 60) + 'm' : ''}`}</span>
                          </div>
                          {cookSetBounds && (
                            <div style={{ marginTop: 8, font: `400 11px ${font.sans}`, color: C.muted }}>
                              {cart.length === 1
                                ? `${cart[0].seller_name} accepts pickups from ${effectiveMin} min to ${effectiveMax < 60 ? effectiveMax + ' min' : Math.floor(effectiveMax / 60) + 'h'}`
                                : `Range narrowed to fit all cooks in your cart`}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div style={{ padding: '22px 22px 0' }}>
                  <div style={{ background: C.card, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', font: `400 13px ${font.sans}`, color: C.inkSoft }}>
                      <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', font: `400 13px ${font.sans}`, color: C.inkSoft }}>
                      <span>Service fee</span><span>${serviceFee.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', font: `400 13px ${font.sans}`, color: C.inkSoft }}>
                      <span>Tip the cook</span>
                      {tipEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={tipAmount}
                            onChange={(e) => setTipAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                            onBlur={() => setTipEditing(false)}
                            autoFocus
                            style={{ width: 60, border: `1px solid ${C.divider}`, borderRadius: 6, padding: '2px 6px', font: `500 13px ${font.sans}`, textAlign: 'right', background: '#fff' }}
                          />
                        </div>
                      ) : (
                        <button onClick={() => setTipEditing(true)} style={{ color: C.terracotta, font: `500 13px ${font.sans}` }}>
                          ${tipAmount.toFixed(2)} · edit
                        </button>
                      )}
                    </div>
                    <div style={{ borderTop: `1px dashed ${C.divider}`, marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between', font: `500 15px ${font.serif}`, color: C.ink }}>
                      <span>Total</span><span>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {cart.length > 0 && (
              <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.hairline}`, padding: '14px 22px 20px', boxShadow: '0 -6px 20px rgba(60,40,20,.07)', maxWidth: 430, margin: '0 auto' }}>
                <button onClick={placeOrder} style={{ width: '100%', background: C.terracotta, color: '#fff', borderRadius: 13, padding: 14, font: `500 14px ${font.sans}` }}>
                  Place order · ${cartTotal.toFixed(2)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= NOTIFICATIONS ================= */}
        {screen === 'notifications' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setScreen('feed')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Notifications</div>
            </div>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', color: C.muted, padding: '40px 20px' }}>
                <Bell size={32} style={{ opacity: .4, marginBottom: 12 }} />
                <p style={{ font: `400 14px ${font.sans}` }}>No notifications yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notifications.map(n => (
                  <div key={n.id} style={{ background: C.card, padding: 16, borderRadius: 14, borderLeft: `4px solid ${n.type === 'ready' ? C.green : C.terracotta}`, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <p style={{ margin: 0, font: `400 14px/1.5 ${font.sans}`, color: C.ink }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= PROFILE (kept from before, restyled minimally) ================= */}
        {screen === 'profile' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setScreen('feed')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ flex: 1, font: `500 22px ${font.serif}`, color: C.ink }}>Your profile</div>
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }}
              />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div onClick={() => profileFileInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: '50%', background: C.cardAlt, fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', cursor: 'pointer', overflow: 'hidden', position: 'relative', color: C.inkSoft }}>
                {profilePhotoPreview ? (
                  <img src={profilePhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : user.photo_url ? (
                  <img src={user.photo_url} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : user.avatar}
                <div style={{ position: 'absolute', bottom: 0, right: 0, background: C.terracotta, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Camera size={12} color="#fff" />
                </div>
              </div>
              <input ref={profileFileInputRef} type="file" accept="image/*" onChange={handleProfilePhotoChange} style={{ display: 'none' }} />
            </div>

            <div style={{ background: C.card, padding: 16, borderRadius: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>Name</div>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: 10, border: `1px solid ${C.divider}`, borderRadius: 8, font: `500 14px ${font.sans}`, marginBottom: 12, background: '#fff' }} />
              <div style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>Bio</div>
              <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={2} style={{ width: '100%', padding: 10, border: `1px solid ${C.divider}`, borderRadius: 8, font: `500 14px ${font.sans}`, marginBottom: 12, background: '#fff', resize: 'none', fontFamily: font.sans }} />
              <button onClick={saveProfile} disabled={savingProfile} style={{ width: '100%', padding: 10, background: C.terracotta, color: '#fff', borderRadius: 10, font: `500 14px ${font.sans}` }}>
                {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>

            <div style={{ background: C.card, padding: 14, borderRadius: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: `400 14px ${font.sans}`, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> Location</span>
                {user.latitude != null ? (
                  <span style={{ font: `500 13px ${font.sans}`, color: C.green }}>Shared</span>
                ) : (
                  <button onClick={requestLocation} style={{ padding: '6px 12px', background: C.cardAlt, borderRadius: 8, font: `500 13px ${font.sans}`, color: C.inkSoft }}>Share location</button>
                )}
              </div>
            </div>

            <div style={{ background: C.card, padding: 14, borderRadius: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <button onClick={() => setScreen('orders')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0, background: 'transparent' }}>
                <span style={{ font: `400 14px ${font.sans}`, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={16} /> Your orders
                  {Object.values(unreadByOrder).reduce((a, b) => a + b, 0) > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 8, background: C.terracotta, color: '#fff', font: `500 10.5px ${font.sans}` }}>
                      <MessageCircle size={10} /> {Object.values(unreadByOrder).reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </span>
                <span style={{ font: `500 13px ${font.sans}`, color: C.terracotta }}>
                  {activeCount > 0 ? `${activeCount} active ›` : `View all ›`}
                </span>
              </button>
            </div>

            <div style={{ background: C.card, padding: 14, borderRadius: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: user.is_seller ? 12 : 0 }}>
                <span style={{ font: `400 14px ${font.sans}`, color: C.inkSoft }}>Seller mode</span>
                <button onClick={toggleSellerMode} style={{ width: 48, height: 28, borderRadius: 14, background: user.is_seller ? C.green : C.divider, position: 'relative', transition: 'all .3s' }}>
                  <div style={{ position: 'absolute', width: 24, height: 24, background: '#fff', borderRadius: '50%', top: 2, left: user.is_seller ? 22 : 2, transition: 'left .3s' }} />
                </button>
              </div>
              {user.is_seller && (
                <button onClick={() => setScreen('seller-dashboard')} style={{ width: '100%', padding: 10, background: C.terracotta, color: '#fff', borderRadius: 10, font: `500 14px ${font.sans}` }}>
                  Go to kitchen
                </button>
              )}
            </div>

            {/* Legal footer */}
            <div style={{ padding: '18px 0 0', display: 'flex', gap: 14, justifyContent: 'center', font: `400 11.5px ${font.sans}`, color: C.muted }}>
              <a href="/terms" style={{ color: C.muted, textDecoration: 'none' }}>Terms</a>
              <span>·</span>
              <a href="/privacy" style={{ color: C.muted, textDecoration: 'none' }}>Privacy</a>
              <span>·</span>
              <span>© Plates {new Date().getFullYear()}</span>
            </div>
          </div>
        )}

        {/* ================= SELLER DASHBOARD ================= */}
        {screen === 'seller-dashboard' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setScreen('feed')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Your kitchen</div>
            </div>
            {user.seller_status === 'approved' && earnings && (
              <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Earnings</div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: C.greenLight, borderRadius: 12, padding: 12 }}>
                    <div style={{ font: `600 20px ${font.serif}`, color: C.green }}>${Number(earnings.earnings?.summary?.total_earnings || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.green }}>Total earned</div>
                  </div>
                  <div style={{ flex: 1, background: C.cardAlt, borderRadius: 12, padding: 12 }}>
                    <div style={{ font: `600 20px ${font.serif}`, color: C.ink }}>{earnings.earnings?.summary?.order_count || 0}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>Orders</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>${Number(earnings.earnings?.thisWeek?.total_earnings || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>This week · {earnings.earnings?.thisWeek?.order_count || 0} orders</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>${Number(earnings.earnings?.thisMonth?.total_earnings || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>This month · {earnings.earnings?.thisMonth?.order_count || 0} orders</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>${Number(earnings.stripe?.available || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>Available to pay out</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>${Number(earnings.stripe?.pending || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>Pending in Stripe</div>
                  </div>
                </div>

                {earnings.stripe?.payouts?.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: `1px solid ${C.divider}`, paddingTop: 12 }}>
                    <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 8 }}>Recent payouts</div>
                    {earnings.stripe.payouts.slice(0, 5).map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', font: `400 12.5px ${font.sans}`, color: C.inkSoft, padding: '4px 0' }}>
                        <span>${Number(p.amount).toFixed(2)}</span>
                        <span style={{ color: C.muted }}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {user.seller_status === 'pending' && (
              <div style={{ background: '#fff9e6', border: '1px solid #f0d67a', borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#b8860b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Bell size={16} />
                </div>
                <div>
                  <div style={{ font: `500 14px ${font.serif}`, color: '#7a5c0b' }}>Under review</div>
                  <div style={{ font: `400 12.5px ${font.sans}`, color: '#7a5c0b', marginTop: 3 }}>
                    Your kitchen is being reviewed by an admin. You can browse and edit your profile, but can&apos;t post dishes yet.
                  </div>
                </div>
              </div>
            )}

            {user.seller_status === 'rejected' && (
              <div style={{ background: '#fceded', border: '1px solid #f5b8b8', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: '#c94b4b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <XCircle size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 14px ${font.serif}`, color: '#8a2a2a' }}>Not approved</div>
                    {user.rejection_reason && (
                      <div style={{ font: `400 12.5px ${font.sans}`, color: '#8a2a2a', marginTop: 3 }}>
                        Reason: {user.rejection_reason}
                      </div>
                    )}
                    <div style={{ font: `400 12px ${font.sans}`, color: '#8a2a2a', marginTop: 6 }}>
                      Update your profile and resubmit for review.
                    </div>
                  </div>
                </div>
                <button
                  onClick={submitForReview}
                  style={{ marginTop: 12, width: '100%', background: C.terracotta, color: '#fff', borderRadius: 10, padding: 10, font: `500 12.5px ${font.sans}` }}
                >
                  Resubmit for review
                </button>
              </div>
            )}

            {user.seller_status === 'suspended' && (
              <div style={{ background: '#fceded', border: '1px solid #f5b8b8', borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: '#c94b4b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Pause size={16} />
                </div>
                <div>
                  <div style={{ font: `500 14px ${font.serif}`, color: '#8a2a2a' }}>Account suspended</div>
                  {user.suspended_reason && (
                    <div style={{ font: `400 12.5px ${font.sans}`, color: '#8a2a2a', marginTop: 3 }}>
                      Reason: {user.suspended_reason}
                    </div>
                  )}
                  <div style={{ font: `400 12px ${font.sans}`, color: '#8a2a2a', marginTop: 6 }}>
                    Your dishes are hidden from buyers. Contact support if you think this is a mistake.
                  </div>
                </div>
              </div>
            )}

            {user.seller_status === 'not_seller' && (
              <div style={{ background: C.card, border: `1px solid ${C.cardAlt}`, borderRadius: 14, padding: 14, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: C.cardAlt, color: C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <ChefHat size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>Fill your kitchen profile</div>
                  <div style={{ font: `400 12.5px ${font.sans}`, color: C.muted, marginTop: 3 }}>
                    Add your legal name, address, cottage-food attestation, and permit info. Then submit for review.
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const filled = [
                user.legal_name, user.kitchen_name, user.cottage_food_attested,
                user.has_permit != null, user.kitchen_flags, user.cooking_hours, user.pickup_description,
              ].filter(Boolean).length;
              const sellerReviewMissing: string[] = [];
              if (!user.legal_name?.trim())      sellerReviewMissing.push('Legal name');
              if (!user.kitchen_name?.trim())    sellerReviewMissing.push('Kitchen name');
              if (!user.cottage_food_attested)   sellerReviewMissing.push('Cottage food attestation');
              if (user.has_permit == null)       sellerReviewMissing.push('Food handler permit answer');
              if (!user.prep_address?.trim())    sellerReviewMissing.push('Kitchen address');
              const total = 7;
              const pct = Math.round((filled / total) * 100);
              const complete = filled === total;
              const approved = user.seller_status === 'approved';
              const showGreen = complete && approved;
              return (
                <div onClick={openCookProfile} style={{ cursor: 'pointer', background: showGreen ? C.greenLight : C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: showGreen ? C.green : C.cardAlt, color: showGreen ? '#fff' : C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <ChefHat size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `500 15px ${font.serif}`, color: showGreen ? C.green : C.ink }}>
                      {complete ? 'Kitchen details filled in' : 'Complete your kitchen profile'}
                    </div>
                    <div style={{ font: `400 11.5px ${font.sans}`, color: showGreen ? C.green : C.muted, marginTop: 2 }}>
                      {complete
                        ? (approved ? 'Buyers can see your kitchen' : 'Waiting on admin approval to go live')
                        : `${filled} of ${total} sections done · ${pct}%`}
                    </div>
                    {!complete && (
                      <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: C.cardAlt, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.terracotta }} />
                      </div>
                    )}
                  </div>
                  <div style={{ color: showGreen ? C.green : C.terracotta, font: `500 12px ${font.sans}`, flex: 'none' }}>{complete ? 'Edit' : 'Set up ›'}</div>
                </div>
              );
            })()}

            <div onClick={() => setScreen('kitchen-queue')} style={{ cursor: 'pointer', background: cookActiveCount > 0 ? C.terracotta : C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: cookActiveCount > 0 ? '#fff' : C.cardAlt, color: cookActiveCount > 0 ? C.terracotta : C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <Receipt size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `500 15px ${font.serif}`, color: cookActiveCount > 0 ? '#fff' : C.ink }}>
                  Kitchen queue
                </div>
                <div style={{ font: `400 12px ${font.sans}`, color: cookActiveCount > 0 ? 'rgba(255,255,255,.85)' : C.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {cookActiveCount > 0
                    ? `${cookActiveCount} active order${cookActiveCount === 1 ? '' : 's'}`
                    : 'No active orders'}
                  {Object.values(unreadByOrder).reduce((a, b) => a + b, 0) > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 8, background: cookActiveCount > 0 ? '#fff' : C.terracotta, color: cookActiveCount > 0 ? C.terracotta : '#fff', font: `500 10.5px ${font.sans}` }}>
                      <MessageCircle size={10} /> {Object.values(unreadByOrder).reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ color: cookActiveCount > 0 ? '#fff' : C.terracotta, font: `500 12px ${font.sans}`, flex: 'none' }}>Open ›</div>
            </div>

            <div style={{ background: C.card, padding: 16, borderRadius: 14, marginBottom: 16, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <p style={{ font: `400 13px ${font.sans}`, color: C.inkSoft, marginBottom: 12 }}>You're selling {myDishes.length} {myDishes.length === 1 ? 'dish' : 'dishes'}</p>

              <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={13} /> Kitchen address
              </div>
              {user.prep_address ? (
                <div style={{ background: C.greenLight, borderRadius: 10, padding: '10px 12px', font: `400 13px ${font.sans}`, color: C.green, marginBottom: 8 }}>
                  {user.prep_address}
                </div>
              ) : null}
              <AddressAutocomplete
                onSelect={(r) => saveAddress(r.address, r.latitude, r.longitude)}
                placeholder={user.prep_address ? 'Change address…' : 'e.g. 123 Main St, Oakland CA'}
                style={{ width: '100%', padding: 10, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff' }}
              />
              <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 6 }}>
                Buyers see this on the pickup map when they order from you.
              </div>
              {!user.prep_address && user.latitude == null && (
                <button onClick={requestLocation} style={{ marginTop: 10, padding: '8px 12px', background: C.cardAlt, borderRadius: 8, font: `500 12px ${font.sans}`, color: C.inkSoft, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Navigation size={13} /> Or use my current location
                </button>
              )}
            </div>

            {user.seller_status === 'approved' && user.is_seller && !user.stripe_charges_enabled ? (
              <div style={{ background: C.card, border: `1px solid ${C.cardAlt}`, borderRadius: 14, padding: 16, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 6 }}>One more step</div>
                <div style={{ font: `400 12.5px ${font.sans}`, color: C.muted, marginBottom: 12 }}>
                  Connect your payment details so you can get paid for orders. We use Stripe to handle payouts securely — you&apos;ll add your bank info on their site.
                </div>
                <button
                  onClick={connectStripePayments}
                  disabled={connectingStripe}
                  style={{ width: '100%', padding: 12, background: C.green, color: '#fff', borderRadius: 10, font: `500 14px ${font.sans}`, border: 'none', cursor: connectingStripe ? 'default' : 'pointer', opacity: connectingStripe ? 0.6 : 1 }}
                >
                  {connectingStripe ? 'Connecting…' : 'Connect payments'}
                </button>
              </div>
            ) : user.seller_status === 'approved' && user.is_seller ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>Order notifications</div>
                    <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginTop: 2 }}>
                      Get notified the moment a new order comes in, even with the app closed.
                    </div>
                  </div>
                  <button
                    onClick={enablePushNotifications}
                    style={{ padding: '10px 14px', background: C.terracotta, color: '#fff', borderRadius: 10, font: `500 13px ${font.sans}`, border: 'none', cursor: 'pointer', flex: 'none' }}
                  >
                    Enable
                  </button>
                </div>
                <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>What are you cooking today?</div>
                <input type="text" id="dishName" placeholder="e.g., Homemade Pasta" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff', marginBottom: 8 }} />

                <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>Price ($)</div>
                <input type="number" id="dishPrice" placeholder="e.g., 12" min="0" step="0.01" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff', marginBottom: 8 }} />

                <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 6 }}>Photo (optional)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div onClick={() => dishFileInputRef.current?.click()} style={{ width: 64, height: 64, borderRadius: 10, background: C.cardAlt, border: `1px dashed ${C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flex: 'none' }}>
                    {dishPhotoPreview ? (
                      <img src={dishPhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Camera size={20} color={C.muted} />
                    )}
                  </div>
                  <input ref={dishFileInputRef} type="file" accept="image/*" onChange={handleDishPhotoChange} style={{ display: 'none' }} />
                  <span style={{ font: `400 13px ${font.sans}`, color: C.muted }}>{dishPhotoFile ? dishPhotoFile.name : 'Tap to add a photo'}</span>
                </div>

                <button onClick={() => {
                  const nameInput = document.getElementById('dishName') as HTMLInputElement;
                  const priceInput = document.getElementById('dishPrice') as HTMLInputElement;
                  const priceValue = parseFloat(priceInput.value);
                  if (nameInput.value.trim() && priceValue > 0) {
                    addDish(nameInput.value.trim(), priceValue);
                    nameInput.value = '';
                    priceInput.value = '';
                  }
                }} style={{ width: '100%', padding: 12, background: C.terracotta, color: '#fff', borderRadius: 10, font: `500 14px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Plus size={16} /> Add to menu
                </button>
              </div>
            ) : user.seller_status === 'not_seller' && user.legal_name && user.kitchen_name && user.cottage_food_attested && user.has_permit != null && user.kitchen_environment && user.cooking_hours && user.pickup_description && user.prep_address ? (
              <div style={{ background: C.greenLight, borderRadius: 14, padding: 16, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ font: `500 15px ${font.serif}`, color: C.green, marginBottom: 6 }}>Ready to submit</div>
                <div style={{ font: `400 12.5px ${font.sans}`, color: C.green, marginBottom: 12 }}>
                  Your kitchen profile is complete. Submit for admin review to start posting dishes.
                </div>
                <button
                  onClick={submitForReview}
                  style={{ background: C.green, color: '#fff', borderRadius: 10, padding: '10px 20px', font: `500 13px ${font.sans}` }}
                >
                  Submit for review
                </button>
              </div>
            ) : null}

            {myDishes.length > 0 && (
              <div>
                <div style={{ font: `500 16px ${font.serif}`, color: C.ink, marginBottom: 10 }}>Your menu</div>
                {myDishes.map(dish => (
                  <div key={dish.id} style={{ background: C.card, padding: 10, borderRadius: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, flex: 'none' }}>
                          <PhotoTile dish={dish} height={40} radius={8} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ font: `500 14px ${font.serif}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <span style={{ font: `400 12px ${font.sans}`, color: C.muted }}>$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={dish.price}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (val > 0 && val !== Number(dish.price)) updatePrice(dish.id, val);
                              }}
                              style={{ width: 60, padding: '2px 4px', border: `1px solid ${C.divider}`, borderRadius: 4, font: `500 12px ${font.sans}`, background: '#fff' }}
                            />
                          </div>
                        </div>
                      </div>
                      <button onClick={() => removeDish(dish.id)} style={{ color: C.terracotta, padding: 4, display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {!dish.photo_url && (
                      <button
                        onClick={() => generatePhotoForDish(dish.id)}
                        disabled={generatingPhotoFor !== null}
                        style={{ marginTop: 10, width: '100%', padding: '8px 12px', background: generatingPhotoFor === dish.id ? C.cardAlt : C.terracottaLight, color: C.terracotta, borderRadius: 8, font: `500 12px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: generatingPhotoFor && generatingPhotoFor !== dish.id ? 0.5 : 1 }}
                      >
                        <Sparkles size={13} />
                        {generatingPhotoFor === dish.id ? 'Generating… (~15 sec)' : 'Generate photo with AI (~$0.04)'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= COOK PROFILE ================= */}
        {screen === 'cook-profile' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 120px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setScreen('seller-dashboard')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Kitchen profile</div>
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 4 }}>Who you are</div>
              <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 14 }}>Your legal name is kept private and used only for payouts.</div>

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Legal full name</label>
              <input type="text" value={cpLegalName} onChange={(e) => setCpLegalName(e.target.value)} placeholder="Marisol Vega Ramírez" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff', marginBottom: 12 }} />

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Kitchen / display name</label>
              <input type="text" value={cpKitchenName} onChange={(e) => setCpKitchenName(e.target.value)} placeholder="Marisol's Handmade Pupusas" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff' }} />
              <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 4 }}>Shown publicly on your dishes. Leave blank to use your account name.</div>
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 4 }}>Legal & compliance</div>
              <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 14 }}>These attestations help keep buyers safe. Rules vary by city and state.</div>

              <div onClick={() => setCpCottage(!cpCottage)} style={{ cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, background: C.surface, borderRadius: 12, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: cpCottage ? C.green : '#fff', border: `2px solid ${cpCottage ? C.green : C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff', font: `700 13px ${font.sans}` }}>
                  {cpCottage ? '✓' : ''}
                </div>
                <div style={{ font: `500 13px/1.5 ${font.sans}`, color: C.ink }}>
                  I understand and comply with my local <b>cottage food / home kitchen laws</b>, and I am legally allowed to sell homemade food.
                </div>
              </div>

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 8, marginTop: 6 }}>Do you have a food handler's permit?</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: cpHasPermit ? 12 : 0 }}>
                <button onClick={() => setCpHasPermit(true)} style={{ flex: 1, padding: 10, background: cpHasPermit === true ? C.terracotta : C.card, color: cpHasPermit === true ? '#fff' : C.inkSoft, border: `1px solid ${cpHasPermit === true ? C.terracotta : C.divider}`, borderRadius: 10, font: `500 13px ${font.sans}` }}>Yes</button>
                <button onClick={() => { setCpHasPermit(false); setCpPermitNumber(''); }} style={{ flex: 1, padding: 10, background: cpHasPermit === false ? C.terracotta : C.card, color: cpHasPermit === false ? '#fff' : C.inkSoft, border: `1px solid ${cpHasPermit === false ? C.terracotta : C.divider}`, borderRadius: 10, font: `500 13px ${font.sans}` }}>No</button>
              </div>
              {cpHasPermit === true && (
                <input type="text" value={cpPermitNumber} onChange={(e) => setCpPermitNumber(e.target.value)} placeholder="Permit / certificate number (optional)" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff' }} />
              )}
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 4 }}>Where do you cook?</div>
              <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 14 }}>Buyers see this so they know the environment your food comes from.</div>
              {[
                'Home kitchen',
                'Commercial kitchen',
                'Community kitchen',
                'Outdoor BBQ',
                'Food cart',
                'Food truck',
              ].map(opt => (
                <div
                  key={opt}
                  onClick={() => setCpKitchenEnvironment(cpKitchenEnvironment === opt ? '' : opt)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: C.surface, borderRadius: 10, marginBottom: 8, border: cpKitchenEnvironment === opt ? `2px solid ${C.green}` : `2px solid transparent` }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: cpKitchenEnvironment === opt ? C.green : '#fff', border: `2px solid ${cpKitchenEnvironment === opt ? C.green : C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff' }}>
                    {cpKitchenEnvironment === opt ? '●' : ''}
                  </div>
                  <div style={{ font: `500 13px ${font.sans}`, color: C.ink }}>{opt}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 4 }}>Kitchen conditions</div>
              <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 14 }}>Buyers with allergies or preferences use these to decide what&apos;s right for them.</div>

              {[
                { key: 'pets', label: 'Pets in the home', state: cpFlagPets, set: setCpFlagPets },
                { key: 'smokers', label: 'Smokers in the home', state: cpFlagSmokers, set: setCpFlagSmokers },
                { key: 'nut-free', label: 'Nut-free kitchen', state: cpFlagNutFree, set: setCpFlagNutFree },
                { key: 'gluten-free', label: 'Gluten-free kitchen', state: cpFlagGlutenFree, set: setCpFlagGlutenFree },
              ].map(f => (
                <div key={f.key} onClick={() => f.set(!f.state)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: C.surface, borderRadius: 10, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: f.state ? C.green : '#fff', border: `2px solid ${f.state ? C.green : C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#fff', font: `700 13px ${font.sans}` }}>
                    {f.state ? '✓' : ''}
                  </div>
                  <div style={{ font: `500 13px ${font.sans}`, color: C.ink }}>{f.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 4 }}>Pickup time window</div>
              <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 14 }}>
                Buyers can choose any pickup time between your minimum and maximum.
              </div>

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 6 }}>
                Minimum: <span style={{ color: C.terracotta }}>{cpPickupMin < 60 ? `${cpPickupMin} min` : `${Math.floor(cpPickupMin / 60)}h${cpPickupMin % 60 ? ' ' + (cpPickupMin % 60) + 'm' : ''}`}</span>
              </label>
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={cpPickupMin}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCpPickupMin(val);
                  if (val >= cpPickupMax) setCpPickupMax(Math.min(240, val + 15));
                }}
                style={{ width: '100%', accentColor: C.terracotta, marginBottom: 4 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', font: `400 10px ${font.sans}`, color: C.muted, marginBottom: 14 }}>
                <span>5 min</span><span>1 hr</span><span>2 hr</span>
              </div>

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 6 }}>
                Maximum: <span style={{ color: C.terracotta }}>{cpPickupMax < 60 ? `${cpPickupMax} min` : `${Math.floor(cpPickupMax / 60)}h${cpPickupMax % 60 ? ' ' + (cpPickupMax % 60) + 'm' : ''}`}</span>
              </label>
              <input
                type="range"
                min={15}
                max={240}
                step={5}
                value={cpPickupMax}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setCpPickupMax(val);
                  if (val <= cpPickupMin) setCpPickupMin(Math.max(5, val - 15));
                }}
                style={{ width: '100%', accentColor: C.terracotta, marginBottom: 4 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', font: `400 10px ${font.sans}`, color: C.muted }}>
                <span>15 min</span><span>2 hr</span><span>4 hr</span>
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 14 }}>Pickup details</div>

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Typical cooking hours</label>
              <input type="text" value={cpCookingHours} onChange={(e) => setCpCookingHours(e.target.value)} placeholder="Weekdays 11am–7pm" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff', marginBottom: 12 }} />

              <label style={{ font: `500 12.5px ${font.sans}`, color: C.inkSoft, display: 'block', marginBottom: 6 }}>Pickup spot description</label>
              <input type="text" value={cpPickupDesc} onChange={(e) => setCpPickupDesc(e.target.value)} placeholder="Front porch, blue door" style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 10, font: `500 14px ${font.sans}`, background: '#fff' }} />
              <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 4 }}>Helps buyers find you.</div>
            </div>

            <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.hairline}`, padding: '14px 22px 20px', maxWidth: 430, margin: '0 auto', boxShadow: '0 -6px 20px rgba(60,40,20,.07)' }}>
              <button onClick={saveCookProfile} disabled={cpSaving} style={{ width: '100%', background: C.terracotta, color: '#fff', borderRadius: 13, padding: 14, font: `500 14px ${font.sans}`, opacity: cpSaving ? .7 : 1 }}>
                {cpSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        )}

        {/* ================= ORDERS LIST (buyer) ================= */}
        {screen === 'orders' && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setScreen('feed')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Your orders</div>
            </div>

            {orders.length === 0 ? (
              <div style={{ padding: '60px 22px', textAlign: 'center', color: C.muted }}>
                <Receipt size={36} style={{ opacity: .4, marginBottom: 14 }} />
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 6 }}>No orders yet</div>
                <div style={{ font: `400 13px ${font.sans}` }}>Head to Discover to find something to eat</div>
              </div>
            ) : (
              <div style={{ padding: '4px 22px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(o => (
                  <div key={o.id} onClick={() => { setSelectedOrder(o); setScreen('order-detail'); }} style={{ cursor: 'pointer', background: C.card, borderRadius: 16, padding: 12, display: 'flex', gap: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ width: 60, height: 60, flex: 'none' }}>
                      <PhotoTile dish={{ photo_url: o.dish_photo_url, emoji: o.dish_emoji, name: o.dish_name }} height={60} radius={11} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ font: `500 14px/1.15 ${font.serif}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {o.quantity} × {o.dish_name}
                        </div>
                        <div style={{ font: `500 14px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(o.total_price).toFixed(2)}</div>
                      </div>
                      <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 4 }}>
                        from {o.seller_kitchen_name || o.seller_name} · {timeAgo(o.created_at)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 8, background: statusColors[o.status] + '22', color: statusColors[o.status], font: `500 11px ${font.sans}` }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[o.status] }} />
                          {statusLabels[o.status]}
                        </div>
                        {unreadByOrder[o.id] > 0 && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 8, background: C.terracotta, color: '#fff', font: `500 11px ${font.sans}` }}>
                            <MessageCircle size={11} /> {unreadByOrder[o.id]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= ORDER DETAIL (buyer) ================= */}
        {screen === 'order-detail' && selectedOrder && (() => {
          const o = selectedOrder;
          const flow: OrderStatus[] = ['placed', 'accepted', 'cooking', 'ready', 'picked_up'];
          const isCancelled = o.status === 'cancelled';
          const currentIndex = flow.indexOf(o.status);
          const canCancel = o.status === 'placed' || o.status === 'accepted';
          return (
            <div style={{ animation: 'plfade .3s ease', paddingBottom: 40 }}>
              <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setScreen('orders')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                  <ArrowLeft size={18} />
                </button>
                <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Order details</div>
              </div>

              {/* Status header */}
              <div style={{ padding: '0 22px' }}>
                <div style={{ background: isCancelled ? '#fceded' : C.card, borderRadius: 16, padding: 18, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ font: `500 12px ${font.sans}`, color: statusColors[o.status], letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {statusLabels[o.status]}
                  </div>
                  <div style={{ font: `500 20px/1.2 ${font.serif}`, color: C.ink }}>
                    {o.status === 'placed' && 'Waiting for cook to accept…'}
                    {o.status === 'accepted' && 'Cook accepted your order.'}
                    {o.status === 'cooking' && 'Your food is being made.'}
                    {o.status === 'ready' && 'Ready for pickup!'}
                    {o.status === 'picked_up' && 'Enjoy your meal!'}
                    {o.status === 'cancelled' && 'This order was cancelled.'}
                  </div>
                  {!isCancelled && (
                    <div style={{ display: 'flex', gap: 5, marginTop: 14 }}>
                      {flow.map((step, i) => (
                        <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= currentIndex ? statusColors[o.status] : C.cardAlt }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pickup time */}
              {o.pickup_at && !isCancelled && o.status !== 'picked_up' && (() => {
                const p = formatPickupAt(o.pickup_at);
                if (!p) return null;
                return (
                  <div style={{ padding: '12px 22px 0' }}>
                    <div style={{ background: p.overdue ? '#fff9e6' : C.card, border: p.overdue ? `1px solid #f0d67a` : 'none', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: p.overdue ? '#b8860b' : C.terracottaLight, color: p.overdue ? '#fff' : C.terracotta, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <Bell size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: `500 12px ${font.sans}`, color: p.overdue ? '#7a5c0b' : C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>Pickup time</div>
                        <div style={{ font: `500 17px ${font.serif}`, color: C.ink, marginTop: 2 }}>{p.clock}</div>
                        <div style={{ font: `400 12px ${font.sans}`, color: p.overdue ? '#8a2a2a' : C.muted, marginTop: 2 }}>
                          {p.overdue ? `Overdue by ${p.relative}` : p.relative}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Pickup code, once ready */}
              {o.status === 'ready' && o.pickup_code && (
                <div style={{ padding: '14px 22px 0' }}>
                  <div style={{ background: C.greenLight, borderRadius: 14, padding: 16, textAlign: 'center' }}>
                    <div style={{ font: `500 12px ${font.sans}`, color: C.green, marginBottom: 6 }}>Show this code at pickup</div>
                    <div style={{ font: `600 32px/1 ${font.serif}`, color: C.green, letterSpacing: '.15em' }}>{o.pickup_code}</div>
                  </div>
                </div>
              )}

              {/* Item(s) */}
              <div style={{ padding: '18px 22px 0' }}>
                <div style={{ background: C.card, borderRadius: 14, padding: 12, display: 'flex', gap: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ width: 62, height: 62, flex: 'none' }}>
                    <PhotoTile dish={{ photo_url: o.dish_photo_url, emoji: o.dish_emoji, name: o.dish_name }} height={62} radius={11} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 15px/1.15 ${font.serif}`, color: C.ink }}>{o.dish_name}</div>
                    <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginTop: 3 }}>Quantity: {o.quantity}</div>
                    <div style={{ font: `500 14px ${font.serif}`, color: C.terracotta, marginTop: 4 }}>${Number(o.total_price).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Cook + pickup card */}
              <div style={{ padding: '14px 22px 0' }}>
                <div style={{ background: C.card, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 8 }}>PICKUP FROM</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {o.seller_photo_url ? (
                      <span style={{ width: 40, height: 40, borderRadius: '50%', backgroundImage: `url(${o.seller_photo_url})`, backgroundSize: 'cover' }} />
                    ) : (
                      <span style={{ width: 40, height: 40, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 14px ${font.sans}` }}>{o.seller_avatar}</span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ font: `500 14px ${font.sans}`, color: C.ink }}>{o.seller_kitchen_name || o.seller_name}</div>
                      {o.seller_cooking_hours && (
                        <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>{o.seller_cooking_hours}</div>
                      )}
                    </div>
                    {o.status !== 'picked_up' && o.status !== 'cancelled' && (
                      <button onClick={() => openChatAsBuyer(o)} style={{ position: 'relative', width: 40, height: 40, borderRadius: 12, background: C.terracottaLight, color: C.terracotta, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <MessageCircle size={18} />
                        {unreadByOrder[o.id] > 0 && (
                          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: C.terracotta, color: '#fff', font: `500 10px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.card}` }}>{unreadByOrder[o.id]}</span>
                        )}
                      </button>
                    )}
                  </div>
                  {o.seller_pickup_description && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: C.surface, borderRadius: 10, font: `400 12.5px ${font.sans}`, color: C.inkSoft }}>
                      <span style={{ color: C.muted }}>Where to find them: </span>{o.seller_pickup_description}
                    </div>
                  )}
                </div>
              </div>

              {/* Map + directions (when ready) */}
              {o.seller_latitude != null && o.seller_longitude != null && (
                <div style={{ padding: '14px 22px 0' }}>
                  <MapView
                    height={200}
                    radius={14}
                    centerLat={o.seller_latitude}
                    centerLng={o.seller_longitude}
                    userLat={user.latitude}
                    userLng={user.longitude}
                    pins={[{
                      id: o.id,
                      lat: o.seller_latitude,
                      lng: o.seller_longitude,
                      photoUrl: o.dish_photo_url,
                      emoji: o.dish_emoji,
                    }]}
                    zoom={14}
                    interactive={false}
                  />
                  <button
                    onClick={() => {
                      const dest = `${o.seller_latitude},${o.seller_longitude}`;
                      window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
                    }}
                    style={{ marginTop: 10, width: '100%', background: C.card, border: `1px solid ${C.divider}`, color: C.ink, borderRadius: 12, padding: 12, font: `500 13px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Navigation size={15} /> Get directions
                  </button>
                </div>
              )}

              {canCancel && (
                <div style={{ padding: '18px 22px 30px' }}>
                  <button onClick={() => cancelOrder(o.id)} style={{ width: '100%', background: 'transparent', border: `1px solid ${C.divider}`, color: '#c94b4b', borderRadius: 12, padding: 12, font: `500 13px ${font.sans}` }}>
                    Cancel order
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ================= KITCHEN QUEUE (cook) ================= */}
        {screen === 'kitchen-queue' && user && !user.is_seller ? (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100, padding: '60px 22px', textAlign: 'center' }}>
            <div style={{ font: `500 20px ${font.serif}`, color: C.ink, marginBottom: 8 }}>Seller mode is off</div>
            <div style={{ font: `400 13.5px ${font.sans}`, color: C.muted, marginBottom: 20 }}>Turn on seller mode to access your kitchen and manage orders.</div>
            <button onClick={toggleSellerMode} style={{ padding: '12px 20px', background: C.green, color: '#fff', border: 'none', borderRadius: 10, font: `500 14px ${font.sans}`, cursor: 'pointer' }}>Turn on seller mode</button>
          </div>
        ) : screen === 'kitchen-queue' && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setScreen('seller-dashboard')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Kitchen queue</div>
            </div>

            {cookOrders.length === 0 ? (
              <div style={{ padding: '60px 22px', textAlign: 'center', color: C.muted }}>
                <ChefHat size={36} style={{ opacity: .4, marginBottom: 14 }} />
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 6 }}>No orders yet</div>
                <div style={{ font: `400 13px ${font.sans}` }}>New orders will appear here in real time.</div>
              </div>
            ) : (
              <div style={{ padding: '4px 22px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cookOrders.map(o => {
                  const isDone = o.status === 'picked_up' || o.status === 'cancelled';
                  return (
                    <div key={o.id} style={{ background: C.card, borderRadius: 16, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)', opacity: isDone ? .6 : 1 }}>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ width: 56, height: 56, flex: 'none' }}>
                          <PhotoTile dish={{ photo_url: o.dish_photo_url, emoji: o.dish_emoji, name: o.dish_name }} height={56} radius={10} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ font: `500 15px/1.15 ${font.serif}`, color: C.ink }}>
                              {o.quantity} × {o.dish_name}
                            </div>
                            <div style={{ font: `500 14px ${font.serif}`, color: C.terracotta, flex: 'none' }}>${Number(o.total_price).toFixed(2)}</div>
                          </div>
                          <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted, marginTop: 3 }}>
                            for {o.buyer_name} · {timeAgo(o.created_at)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 8, background: statusColors[o.status] + '22', color: statusColors[o.status], font: `500 11px ${font.sans}` }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[o.status] }} />
                              {statusLabels[o.status]}
                            </div>
                            {o.pickup_at && !isDone && (() => {
                              const p = formatPickupAt(o.pickup_at);
                              if (!p) return null;
                              return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 8, background: p.overdue ? '#fff9e6' : C.terracottaLight, color: p.overdue ? '#7a5c0b' : C.terracotta, font: `500 11px ${font.sans}` }}>
                                  <Bell size={11} />
                                  {p.clock} · {p.overdue ? `overdue ${p.relative}` : p.relative}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {!isDone && (
                        confirmingPickupFor === o.id ? (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ font: `500 12px ${font.sans}`, color: C.inkSoft, marginBottom: 8 }}>
                              Ask the buyer for their 4-digit pickup code:
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', animation: pickupCodeError ? 'plshake .4s ease' : undefined }}>
                              {[0, 1, 2, 3].map(i => (
                                <input
                                  key={i}
                                  ref={(el) => { pickupInputRefs.current[i] = el; }}
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={1}
                                  value={pickupCodeInput[i]}
                                  onChange={(e) => handlePickupDigit(i, e.target.value, o.id)}
                                  onKeyDown={(e) => handlePickupKey(i, e)}
                                  disabled={pickupCodeSubmitting}
                                  style={{
                                    width: 48,
                                    height: 56,
                                    borderRadius: 12,
                                    border: `2px solid ${pickupCodeError ? '#c94b4b' : (pickupCodeInput[i] ? C.terracotta : C.divider)}`,
                                    background: '#fff',
                                    textAlign: 'center',
                                    font: `600 22px ${font.serif}`,
                                    color: pickupCodeError ? '#c94b4b' : C.ink,
                                    outline: 'none',
                                  }}
                                />
                              ))}
                            </div>
                            {pickupCodeError && (
                              <div style={{ marginTop: 8, textAlign: 'center', font: `500 12px ${font.sans}`, color: '#c94b4b' }}>
                                Wrong code. Try again.
                              </div>
                            )}
                            <button
                              onClick={() => { setConfirmingPickupFor(null); setPickupCodeError(false); }}
                              disabled={pickupCodeSubmitting}
                              style={{ marginTop: 12, width: '100%', background: 'transparent', color: C.muted, font: `500 12px ${font.sans}`, padding: 8 }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : confirmingCookCancelFor === o.id ? (
                          <div style={{ marginTop: 12 }}>
                            <div style={{ font: `500 12px ${font.sans}`, color: C.inkSoft, marginBottom: 10 }}>
                              Cancel this order? The buyer will be refunded automatically.
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setConfirmingCookCancelFor(null)}
                                disabled={cookCancelSubmitting}
                                style={{ flex: 1, background: 'transparent', border: `1px solid ${C.divider}`, color: C.inkSoft, borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}
                              >
                                Keep order
                              </button>
                              <button
                                onClick={() => cookCancelOrder(o.id)}
                                disabled={cookCancelSubmitting}
                                style={{ flex: 1, background: '#c94b4b', color: '#fff', borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}
                              >
                                {cookCancelSubmitting ? 'Cancelling…' : 'Cancel & refund'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            {o.status === 'placed' && (
                              <>
                                <button onClick={() => updateOrderStatus(o.id, 'cancelled')} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.divider}`, color: '#c94b4b', borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}>Decline</button>
                                <button onClick={() => updateOrderStatus(o.id, 'accepted')} style={{ flex: 2, background: C.terracotta, color: '#fff', borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}>Accept order</button>
                              </>
                            )}
                            {o.status === 'accepted' && (
                              <>
                                <button onClick={() => updateOrderStatus(o.id, 'cooking')} style={{ flex: 1, background: C.terracotta, color: '#fff', borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}>Start cooking</button>
                                <button onClick={() => setConfirmingCookCancelFor(o.id)} style={{ flex: 'none', width: 40, height: 40, borderRadius: 10, background: 'transparent', border: `1px solid ${C.divider}`, color: '#c94b4b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </>
                            )}
                            {o.status === 'cooking' && (
                              <>
                                <button onClick={() => updateOrderStatus(o.id, 'ready')} style={{ flex: 1, background: C.green, color: '#fff', borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}>Mark ready</button>
                                <button onClick={() => setConfirmingCookCancelFor(o.id)} style={{ flex: 'none', width: 40, height: 40, borderRadius: 10, background: 'transparent', border: `1px solid ${C.divider}`, color: '#c94b4b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </>
                            )}
                            {o.status === 'ready' && (
                              <button onClick={() => openPickupConfirmation(o.id)} style={{ flex: 1, background: C.ink, color: '#fff', borderRadius: 10, padding: 10, font: `500 12px ${font.sans}` }}>Enter pickup code</button>
                            )}
                            <button onClick={() => openChatAsCook(o)} style={{ position: 'relative', width: 40, height: 40, borderRadius: 10, background: C.terracottaLight, color: C.terracotta, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                              <MessageCircle size={16} />
                              {unreadByOrder[o.id] > 0 && (
                                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: C.terracotta, color: '#fff', font: `500 10px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${C.card}` }}>{unreadByOrder[o.id]}</span>
                              )}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= CHAT (order-scoped) ================= */}
        {screen === 'chat' && chatOrder && (() => {
          const isClosed = chatOrder.status === 'picked_up' || chatOrder.status === 'cancelled';
          const templates = ['On my way', 'Running late', "I'm here", 'Thanks!'];
          return (
            <div style={{ animation: 'plfade .3s ease', height: '100vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '18px 22px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.hairline}`, background: C.card }}>
                <button onClick={() => {
                  // Return to whichever screen makes sense
                  if (user.is_seller && cookOrders.find(c => c.id === chatOrder.id)) setScreen('kitchen-queue');
                  else setScreen('order-detail');
                }} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                  <ArrowLeft size={18} />
                </button>
                {chatOtherPartyPhoto ? (
                  <span style={{ width: 36, height: 36, borderRadius: '50%', backgroundImage: `url(${chatOtherPartyPhoto})`, backgroundSize: 'cover' }} />
                ) : (
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 13px ${font.sans}` }}>{chatOtherPartyAvatar}</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `500 15px ${font.serif}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chatOtherPartyName}</div>
                  <div style={{ font: `400 11px ${font.sans}`, color: statusColors[chatOrder.status] }}>
                    {statusLabels[chatOrder.status]}
                  </div>
                </div>
              </div>

              {/* Message list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: C.surface }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: C.muted }}>
                    <MessageCircle size={28} style={{ opacity: .4, marginBottom: 10 }} />
                    <div style={{ font: `500 14px ${font.serif}`, color: C.ink, marginBottom: 4 }}>No messages yet</div>
                    <div style={{ font: `400 12px ${font.sans}` }}>Say hi or use a quick reply below.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {messages.map((m, i) => {
                      const isMe = m.sender_id === user.id;
                      const prev = messages[i - 1];
                      const showTime = !prev || (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000);
                      return (
                        <React.Fragment key={m.id}>
                          {showTime && (
                            <div style={{ textAlign: 'center', font: `400 10.5px ${font.sans}`, color: C.muted, margin: '6px 0' }}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{
                              maxWidth: '78%',
                              padding: '10px 14px',
                              borderRadius: 16,
                              borderBottomRightRadius: isMe ? 4 : 16,
                              borderBottomLeftRadius: isMe ? 16 : 4,
                              background: isMe ? C.terracotta : C.card,
                              color: isMe ? '#fff' : C.ink,
                              font: `400 14px/1.4 ${font.sans}`,
                              wordBreak: 'break-word',
                            }}>
                              {m.body}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              {isClosed ? (
                <div style={{ padding: '14px 22px 20px', background: C.card, borderTop: `1px solid ${C.hairline}`, textAlign: 'center', color: C.muted, font: `400 13px ${font.sans}` }}>
                  This order is {chatOrder.status === 'cancelled' ? 'cancelled' : 'complete'} — messages are closed.
                </div>
              ) : (
                <div style={{ background: C.card, borderTop: `1px solid ${C.hairline}`, padding: '10px 16px 16px' }}>
                  {/* Quick replies */}
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 4 }}>
                    {templates.map(t => (
                      <button
                        key={t}
                        onClick={() => sendMessageAction(t)}
                        disabled={sending}
                        style={{ flex: 'none', padding: '7px 12px', background: C.surface, color: C.inkSoft, border: `1px solid ${C.divider}`, borderRadius: 16, font: `500 12px ${font.sans}`, whiteSpace: 'nowrap' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessageAction();
                        }
                      }}
                      placeholder="Type a message…"
                      rows={1}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: `1px solid ${C.divider}`,
                        borderRadius: 20,
                        font: `400 14px ${font.sans}`,
                        background: C.surface,
                        resize: 'none',
                        maxHeight: 100,
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => sendMessageAction()}
                      disabled={!messageDraft.trim() || sending}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        background: messageDraft.trim() && !sending ? C.terracotta : C.cardAlt,
                        color: messageDraft.trim() && !sending ? '#fff' : C.mutedLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                      }}
                    >
                      <Send size={17} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {(screen === 'feed') && (
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.hairline}`, display: 'flex', justifyContent: 'space-around', padding: '10px 0 14px', maxWidth: 430, margin: '0 auto' }}>
            <button onClick={() => setScreen('feed')} style={{ textAlign: 'center', color: C.terracotta, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <Compass size={22} strokeWidth={2.5} />
              <span style={{ font: `500 10px ${font.sans}` }}>Discover</span>
            </button>
            <button onClick={() => setScreen('cart')} style={{ textAlign: 'center', color: C.mutedLight, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <ShoppingBag size={22} strokeWidth={2} />
              {cartCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: '50%', marginRight: -18, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: C.terracotta, color: '#fff', font: `500 9px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>
              )}
              <span style={{ font: `500 10px ${font.sans}` }}>Cart</span>
            </button>
            <button onClick={() => setScreen('seller-dashboard')} style={{ textAlign: 'center', color: C.mutedLight, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <ChefHat size={22} />
              <span style={{ font: `500 10px ${font.sans}` }}>Cook</span>
            </button>
            <button onClick={() => setScreen('profile')} style={{ textAlign: 'center', color: C.mutedLight, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <UserIcon size={22} />
              <span style={{ font: `500 10px ${font.sans}` }}>You</span>
            </button>
          </div>
        )}

        {/* ================= ADMIN: DASHBOARD ================= */}
        {screen === 'admin' && user.role === 'admin' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setScreen('feed')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ flex: 1, font: `500 22px ${font.serif}`, color: C.ink }}>Admin</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: C.ink, color: '#fff', borderRadius: 12, font: `500 10px ${font.sans}`, letterSpacing: '.05em' }}>
                <Shield size={11} /> ADMIN
              </div>
            </div>

            {adminStats && adminStats.pending > 0 && (
              <div onClick={() => setScreen('admin-pending')} style={{ cursor: 'pointer', background: C.terracotta, borderRadius: 14, padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', color: C.terracotta, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <Bell size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: `500 15px ${font.serif}` }}>
                    {adminStats.pending} pending seller{adminStats.pending === 1 ? '' : 's'}
                  </div>
                  <div style={{ font: `400 12px ${font.sans}`, opacity: .9, marginTop: 2 }}>
                    Waiting for your review
                  </div>
                </div>
                <ChevronRight size={20} />
              </div>
            )}

            {adminFinancials && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Financials</div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: C.greenLight, borderRadius: 12, padding: 14 }}>
                    <div style={{ font: `600 22px ${font.serif}`, color: C.green }}>${Number(adminFinancials.totals?.platform_revenue || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.green }}>Platform revenue</div>
                  </div>
                  <div style={{ flex: 1, background: C.cardAlt, borderRadius: 12, padding: 14 }}>
                    <div style={{ font: `600 22px ${font.serif}`, color: C.ink }}>${Number(adminFinancials.totals?.gross_sales || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>Gross sales</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <div style={{ flex: 1, background: C.card, borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ font: `600 18px ${font.serif}`, color: C.ink }}>${Number(adminFinancials.totals?.cook_payouts || 0).toFixed(2)}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>Cook payouts</div>
                  </div>
                  <div style={{ flex: 1, background: C.card, borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ font: `600 18px ${font.serif}`, color: C.ink }}>{adminFinancials.totals?.order_count || 0}</div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>Orders</div>
                  </div>
                </div>

                {adminFinancials.topCooks?.length > 0 && (
                  <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 10 }}>Top cooks by sales</div>
                    {adminFinancials.topCooks.slice(0, 5).map((c: any) => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${C.hairline}` }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ font: `500 13px ${font.sans}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.kitchen_name || c.name}</div>
                          <div style={{ font: `400 11px ${font.sans}`, color: C.muted }}>{c.order_count} orders</div>
                        </div>
                        <div style={{ textAlign: 'right', flex: 'none' }}>
                          <div style={{ font: `500 13px ${font.sans}`, color: C.ink }}>${Number(c.gross_sales).toFixed(2)}</div>
                          <div style={{ font: `400 11px ${font.sans}`, color: C.green }}>+${Number(c.platform_revenue).toFixed(2)} fee</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {adminFinancials.trend?.length > 0 && (
                  <div style={{ background: C.card, borderRadius: 14, padding: 16, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 10 }}>Last 30 days</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                      {(() => {
                        const max = Math.max(...adminFinancials.trend.map((d: any) => Number(d.sales)), 1);
                        return adminFinancials.trend.map((d: any, i: number) => (
                          <div key={i} title={`${d.day}: $${Number(d.sales).toFixed(2)}`} style={{ flex: 1, background: C.green, borderRadius: 2, height: `${Math.max(4, (Number(d.sales) / max) * 80)}px`, opacity: 0.7 }} />
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Users', value: adminStats?.totalUsers ?? '—', color: C.ink },
                { label: 'Sellers', value: adminStats?.sellers ?? '—', color: C.green },
                { label: 'Dishes', value: adminStats?.totalDishes ?? '—', color: C.terracotta },
                { label: 'Orders', value: adminStats?.totalOrders ?? '—', color: C.gold },
              ].map(t => (
                <div key={t.label} style={{ background: C.card, borderRadius: 12, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ font: `500 11px ${font.sans}`, color: C.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t.label}</div>
                  <div style={{ font: `600 24px ${font.serif}`, color: t.color, marginTop: 4 }}>{t.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 14, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <button onClick={() => setScreen('admin-pending')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: `1px solid ${C.hairline}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: adminStats && adminStats.pending > 0 ? C.terracottaLight : C.cardAlt, color: adminStats && adminStats.pending > 0 ? C.terracotta : C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={17} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>Pending sellers</div>
                  <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>{adminStats?.pending ?? 0} waiting</div>
                </div>
                <ChevronRight size={16} color={C.muted} />
              </button>
              <button onClick={() => setScreen('admin-users')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderBottom: `1px solid ${C.hairline}` }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: C.cardAlt, color: C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={17} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>All users</div>
                  <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>Search, filter, moderate</div>
                </div>
                <ChevronRight size={16} color={C.muted} />
              </button>
              <button onClick={() => setScreen('admin-dishes')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: C.cardAlt, color: C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={17} />
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>Dish moderation</div>
                  <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>
                    Delete dishes{adminStats && adminStats.orphanDishes > 0 ? ` · ${adminStats.orphanDishes} with no photo` : ''}
                  </div>
                </div>
                <ChevronRight size={16} color={C.muted} />
              </button>
            </div>

            <div style={{ font: `400 11px ${font.sans}`, color: C.muted, textAlign: 'center', marginTop: 20 }}>
              {adminStats?.admins ?? 0} admin{adminStats?.admins === 1 ? '' : 's'} · {adminStats?.suspended ?? 0} suspended
            </div>
          </div>
        )}

        {/* ================= ADMIN: PENDING SELLERS ================= */}
        {screen === 'admin-pending' && user.role === 'admin' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button onClick={() => setScreen('admin')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Pending sellers</div>
            </div>

            {adminPending.length === 0 ? (
              <div style={{ padding: '40px 22px', textAlign: 'center', color: C.muted }}>
                <CheckCircle size={32} style={{ opacity: .4, marginBottom: 12, color: C.green }} />
                <div style={{ font: `500 14px ${font.serif}`, color: C.ink }}>No one waiting</div>
                <div style={{ font: `400 12px ${font.sans}`, marginTop: 4 }}>You&apos;re all caught up.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {adminPending.map(p => (
                  <div key={p.id} style={{ background: C.card, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {p.photo_url ? (
                        <span style={{ width: 44, height: 44, borderRadius: '50%', backgroundImage: `url(${p.photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
                      ) : (
                        <span style={{ width: 44, height: 44, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 16px ${font.sans}`, flex: 'none' }}>{p.avatar}</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: `500 15px ${font.serif}`, color: C.ink }}>{p.kitchen_name || p.name}</div>
                        <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginTop: 2 }}>
                          {p.legal_name} · {p.email}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, font: `400 11.5px ${font.sans}` }}>
                      <div style={{ padding: 8, background: C.surface, borderRadius: 8 }}>
                        <div style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>ADDRESS</div>
                        <div style={{ color: C.ink }}>{p.prep_address || '—'}</div>
                      </div>
                      <div style={{ padding: 8, background: C.surface, borderRadius: 8 }}>
                        <div style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>PERMIT</div>
                        <div style={{ color: C.ink }}>{p.has_permit ? (p.permit_number || 'Yes (no #)') : 'No'}</div>
                      </div>
                      <div style={{ padding: 8, background: C.surface, borderRadius: 8 }}>
                        <div style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>HOURS</div>
                        <div style={{ color: C.ink }}>{p.cooking_hours || '—'}</div>
                      </div>
                      <div style={{ padding: 8, background: C.surface, borderRadius: 8 }}>
                        <div style={{ color: C.muted, fontSize: 10, marginBottom: 2 }}>ATTESTED</div>
                        <div style={{ color: p.cottage_food_attested ? C.green : '#c94b4b' }}>{p.cottage_food_attested ? 'Yes' : 'No'}</div>
                      </div>
                    </div>

                    {p.kitchen_flags && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {p.kitchen_flags.split(',').map((f: string) => f.trim()).filter(Boolean).map((flag: string) => (
                          <span key={flag} style={{ background: C.surface, color: C.inkSoft, padding: '3px 8px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}

                    {adminShowRejectFor === p.id ? (
                      <div style={{ marginTop: 12, padding: 12, background: '#fceded', borderRadius: 10 }}>
                        <div style={{ font: `500 12px ${font.sans}`, color: '#8a2a2a', marginBottom: 6 }}>Rejection reason</div>
                        <textarea
                          value={adminRejectReason}
                          onChange={(e) => setAdminRejectReason(e.target.value)}
                          placeholder="Why isn't this seller approved?"
                          rows={2}
                          style={{ width: '100%', padding: 8, border: `1px solid ${C.divider}`, borderRadius: 8, font: `400 13px ${font.sans}`, background: '#fff', resize: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button onClick={() => { setAdminShowRejectFor(null); setAdminRejectReason(''); }} style={{ flex: 1, padding: 8, background: 'transparent', color: C.muted, borderRadius: 8, font: `500 12px ${font.sans}` }}>Cancel</button>
                          <button
                            onClick={() => adminRejectSeller(p.id, adminRejectReason)}
                            disabled={adminActionSubmitting || !adminRejectReason.trim()}
                            style={{ flex: 2, padding: 8, background: '#c94b4b', color: '#fff', borderRadius: 8, font: `500 12px ${font.sans}`, opacity: adminActionSubmitting ? .7 : 1 }}
                          >
                            Confirm reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          onClick={() => setAdminShowRejectFor(p.id)}
                          disabled={adminActionSubmitting}
                          style={{ flex: 1, padding: 10, background: 'transparent', border: `1px solid ${C.divider}`, color: '#c94b4b', borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                        <button
                          onClick={() => adminApproveSeller(p.id)}
                          disabled={adminActionSubmitting}
                          style={{ flex: 2, padding: 10, background: C.green, color: '#fff', borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: adminActionSubmitting ? .7 : 1 }}
                        >
                          <CheckCircle size={14} /> Approve
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= ADMIN: ALL USERS ================= */}
        {screen === 'admin-users' && user.role === 'admin' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <button onClick={() => setScreen('admin')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>All users</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <Search size={15} color={C.muted} />
              <input
                type="text"
                value={adminUserSearch}
                onChange={(e) => setAdminUserSearch(e.target.value)}
                placeholder="Search by name or email…"
                style={{ flex: 1, border: 'none', outline: 'none', font: `400 13px ${font.sans}`, background: 'transparent' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending' },
                { key: 'sellers', label: 'Sellers' },
                { key: 'suspended', label: 'Suspended' },
                { key: 'admins', label: 'Admins' },
                { key: 'disabled', label: 'Disabled' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setAdminUserFilter(f.key as any)}
                  style={{ flex: 'none', padding: '6px 12px', background: adminUserFilter === f.key ? C.ink : C.card, color: adminUserFilter === f.key ? '#fff' : C.inkSoft, border: `1px solid ${adminUserFilter === f.key ? C.ink : C.divider}`, borderRadius: 16, font: `500 12px ${font.sans}`, whiteSpace: 'nowrap' }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adminUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => loadAdminUserDetail(u.id)}
                  style={{ background: C.card, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(60,40,20,.05)', textAlign: 'left', opacity: u.account_disabled ? .5 : 1 }}
                >
                  {u.photo_url ? (
                    <span style={{ width: 38, height: 38, borderRadius: '50%', backgroundImage: `url(${u.photo_url})`, backgroundSize: 'cover', flex: 'none' }} />
                  ) : (
                    <span style={{ width: 38, height: 38, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 14px ${font.sans}`, flex: 'none' }}>{u.avatar}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: `500 14px ${font.serif}`, color: C.ink }}>{u.name}</span>
                      {u.role === 'admin' && (
                        <span style={{ padding: '1px 6px', background: C.ink, color: '#fff', borderRadius: 6, font: `500 9px ${font.sans}`, letterSpacing: '.05em' }}>ADMIN</span>
                      )}
                    </div>
                    <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                      {u.seller_status !== 'not_seller' && (
                        <span style={{
                          padding: '2px 7px', borderRadius: 6, font: `500 10px ${font.sans}`,
                          background: u.seller_status === 'approved' ? C.greenLight : u.seller_status === 'pending' ? '#fff9e6' : '#fceded',
                          color: u.seller_status === 'approved' ? C.green : u.seller_status === 'pending' ? '#7a5c0b' : '#8a2a2a'
                        }}>
                          {u.seller_status}
                        </span>
                      )}
                      {u.account_disabled && (
                        <span style={{ padding: '2px 7px', borderRadius: 6, font: `500 10px ${font.sans}`, background: '#fceded', color: '#8a2a2a' }}>disabled</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={14} color={C.muted} />
                </button>
              ))}
              {adminUsers.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: C.muted, font: `400 13px ${font.sans}` }}>
                  No users match this filter.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ADMIN: USER DETAIL ================= */}
        {screen === 'admin-user-detail' && user.role === 'admin' && adminSelectedUser && (() => {
          const u = adminSelectedUser.user;
          const isMe = u.id === user.id;
          return (
            <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button onClick={() => setScreen('admin-users')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                  <ArrowLeft size={18} />
                </button>
                <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>User</div>
              </div>

              <div style={{ background: C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  {u.photo_url ? (
                    <span style={{ width: 54, height: 54, borderRadius: '50%', backgroundImage: `url(${u.photo_url})`, backgroundSize: 'cover' }} />
                  ) : (
                    <span style={{ width: 54, height: 54, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 22px ${font.sans}` }}>{u.avatar}</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ font: `500 17px ${font.serif}`, color: C.ink }}>{u.name}</span>
                      {u.role === 'admin' && (
                        <span style={{ padding: '2px 8px', background: C.ink, color: '#fff', borderRadius: 6, font: `500 9px ${font.sans}`, letterSpacing: '.05em' }}>ADMIN</span>
                      )}
                      {isMe && (
                        <span style={{ padding: '2px 8px', background: C.terracottaLight, color: C.terracotta, borderRadius: 6, font: `500 9px ${font.sans}` }}>YOU</span>
                      )}
                    </div>
                    <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted, marginTop: 2 }}>{u.email}</div>
                    {u.kitchen_name && (
                      <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted }}>Kitchen: {u.kitchen_name}</div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {[
                    { label: 'DISHES', value: adminSelectedUser.stats.dishes },
                    { label: 'BOUGHT', value: adminSelectedUser.stats.ordersAsBuyer },
                    { label: 'SOLD', value: adminSelectedUser.stats.ordersAsSeller },
                  ].map(s => (
                    <div key={s.label} style={{ padding: 10, background: C.surface, borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ font: `500 10px ${font.sans}`, color: C.muted, letterSpacing: '.05em' }}>{s.label}</div>
                      <div style={{ font: `600 18px ${font.serif}`, color: C.ink, marginTop: 2 }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Seller status card */}
              <div style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Seller status</div>
                <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 6 }}>
                  {u.seller_status === 'not_seller' && 'Not a seller'}
                  {u.seller_status === 'pending' && 'Pending review'}
                  {u.seller_status === 'approved' && 'Approved seller'}
                  {u.seller_status === 'rejected' && 'Rejected'}
                  {u.seller_status === 'suspended' && 'Suspended'}
                </div>
                {u.rejection_reason && (
                  <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 8 }}>
                    Rejection reason: {u.rejection_reason}
                  </div>
                )}
                {u.suspended_reason && (
                  <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 8 }}>
                    Suspension reason: {u.suspended_reason}
                  </div>
                )}

                {u.seller_status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => adminApproveSeller(u.id)} disabled={adminActionSubmitting} style={{ flex: 1, padding: 10, background: C.green, color: '#fff', borderRadius: 10, font: `500 12.5px ${font.sans}` }}>Approve</button>
                    <button onClick={() => setAdminShowRejectFor(u.id)} disabled={adminActionSubmitting} style={{ flex: 1, padding: 10, background: 'transparent', border: `1px solid ${C.divider}`, color: '#c94b4b', borderRadius: 10, font: `500 12.5px ${font.sans}` }}>Reject</button>
                  </div>
                )}
                {u.seller_status === 'approved' && !isMe && (
                  <button onClick={() => setAdminShowSuspendFor(u.id)} disabled={adminActionSubmitting} style={{ width: '100%', padding: 10, background: '#fff9e6', border: `1px solid #f0d67a`, color: '#7a5c0b', borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Pause size={14} /> Suspend seller
                  </button>
                )}
                {u.seller_status === 'suspended' && (
                  <button onClick={() => adminUnsuspendSeller(u.id)} disabled={adminActionSubmitting} style={{ width: '100%', padding: 10, background: C.green, color: '#fff', borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Play size={14} /> Reinstate
                  </button>
                )}

                {adminShowRejectFor === u.id && (
                  <div style={{ marginTop: 10, padding: 12, background: '#fceded', borderRadius: 10 }}>
                    <textarea value={adminRejectReason} onChange={(e) => setAdminRejectReason(e.target.value)} placeholder="Rejection reason" rows={2} style={{ width: '100%', padding: 8, border: `1px solid ${C.divider}`, borderRadius: 8, font: `400 13px ${font.sans}`, background: '#fff', resize: 'none' }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => { setAdminShowRejectFor(null); setAdminRejectReason(''); }} style={{ flex: 1, padding: 8, background: 'transparent', color: C.muted, borderRadius: 8, font: `500 12px ${font.sans}` }}>Cancel</button>
                      <button onClick={() => adminRejectSeller(u.id, adminRejectReason)} disabled={!adminRejectReason.trim()} style={{ flex: 2, padding: 8, background: '#c94b4b', color: '#fff', borderRadius: 8, font: `500 12px ${font.sans}` }}>Confirm reject</button>
                    </div>
                  </div>
                )}

                {adminShowSuspendFor === u.id && (
                  <div style={{ marginTop: 10, padding: 12, background: '#fff9e6', borderRadius: 10 }}>
                    <textarea value={adminSuspendReason} onChange={(e) => setAdminSuspendReason(e.target.value)} placeholder="Why suspend this seller?" rows={2} style={{ width: '100%', padding: 8, border: `1px solid ${C.divider}`, borderRadius: 8, font: `400 13px ${font.sans}`, background: '#fff', resize: 'none' }} />
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => { setAdminShowSuspendFor(null); setAdminSuspendReason(''); }} style={{ flex: 1, padding: 8, background: 'transparent', color: C.muted, borderRadius: 8, font: `500 12px ${font.sans}` }}>Cancel</button>
                      <button onClick={() => adminSuspendSeller(u.id, adminSuspendReason)} disabled={!adminSuspendReason.trim()} style={{ flex: 2, padding: 8, background: '#b8860b', color: '#fff', borderRadius: 8, font: `500 12px ${font.sans}` }}>Confirm suspend</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Account controls */}
              {!isMe && (
                <div style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Account</div>

                  <button onClick={() => adminToggleDisabled(u.id, !u.account_disabled)} disabled={adminActionSubmitting} style={{ width: '100%', padding: 10, marginBottom: 8, background: u.account_disabled ? C.green : '#fceded', color: u.account_disabled ? '#fff' : '#8a2a2a', border: u.account_disabled ? 'none' : `1px solid #f5b8b8`, borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {u.account_disabled ? <><UserCheck size={14} /> Re-enable account</> : <><UserX size={14} /> Disable account</>}
                  </button>

                  <button onClick={() => adminSetRole(u.id, u.role === 'admin' ? 'user' : 'admin')} disabled={adminActionSubmitting} style={{ width: '100%', padding: 10, background: u.role === 'admin' ? '#fceded' : C.ink, color: u.role === 'admin' ? '#8a2a2a' : '#fff', border: u.role === 'admin' ? `1px solid #f5b8b8` : 'none', borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Shield size={14} /> {u.role === 'admin' ? 'Remove admin' : 'Promote to admin'}
                  </button>
                 {adminDeleteConfirmingFor !== u.id ? (
                    <button
                      onClick={() => { setAdminDeleteConfirmingFor(u.id); setAdminDeleteChecked(false); }}
                      disabled={adminActionSubmitting}
                      style={{ width: '100%', padding: 10, background: '#c0392b', color: '#fff', borderRadius: 10, font: `500 12.5px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Trash2 size={14} /> Delete user permanently
                    </button>
                  ) : (
                    <div style={{ background: '#fff5f5', border: '1px solid #c0392b', borderRadius: 10, padding: 12 }}>
                      <div style={{ font: `500 13px ${font.sans}`, color: '#c0392b', marginBottom: 8 }}>
                        Delete {u.name || u.email}?
                      </div>
                      <div style={{ font: `400 12px ${font.sans}`, color: C.ink, marginBottom: 10, lineHeight: 1.4 }}>
                        This permanently deletes their profile, dishes, posts, and photos. Any open orders will be refunded. Paid/completed orders are preserved for accounting.
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', font: `400 12px ${font.sans}`, color: C.ink }}>
                        <input
                          type="checkbox"
                          checked={adminDeleteChecked}
                          onChange={(e) => setAdminDeleteChecked(e.target.checked)}
                        />
                        I understand this is permanent
                      </label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => { setAdminDeleteConfirmingFor(null); setAdminDeleteChecked(false); }}
                          disabled={adminActionSubmitting}
                          style={{ flex: 1, padding: 8, background: C.cardAlt, color: C.ink, borderRadius: 8, font: `500 12px ${font.sans}` }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => adminDeleteUser(u.id)}
                          disabled={!adminDeleteChecked || adminActionSubmitting}
                          style={{ flex: 2, padding: 8, background: '#c0392b', color: '#fff', borderRadius: 8, font: `500 12px ${font.sans}`, opacity: (!adminDeleteChecked || adminActionSubmitting) ? 0.5 : 1 }}
                        >
                          {adminActionSubmitting ? 'Deleting…' : 'Delete permanently'}
                        </button>
                      </div>
                    </div>
                  )} 
                </div>
              )}

              {adminSelectedUserOrders.length > 0 && (
                <div style={{ background: C.card, borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ font: `500 12px ${font.sans}`, color: C.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Recent orders ({adminSelectedUserOrders.length})</div>
                  {adminSelectedUserOrders.slice(0, 20).map((o: any) => (
                    <div key={o.id} style={{ padding: '8px 0', borderBottom: `1px solid ${C.hairline}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: `500 12.5px ${font.sans}`, color: C.ink }}>
                          {o.quantity}× {o.dish_name}
                        </div>
                        <div style={{ font: `400 11px ${font.sans}`, color: C.muted, marginTop: 2 }}>
                          {o.buyer_id === u.id ? `bought from ${o.seller_name}` : `sold to ${o.buyer_name}`} · {timeAgo(o.created_at)}
                        </div>
                      </div>
                      <div style={{ flex: 'none', textAlign: 'right' }}>
                        <div style={{ font: `500 12.5px ${font.serif}`, color: C.terracotta }}>${Number(o.total_price).toFixed(2)}</div>
                        <div style={{ font: `400 10px ${font.sans}`, color: C.muted, marginTop: 2 }}>{o.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ================= ADMIN: DISH MODERATION ================= */}
        {screen === 'admin-dishes' && user.role === 'admin' && (
          <div style={{ animation: 'plfade .3s ease', padding: '20px 22px 100px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <button onClick={() => setScreen('admin')} style={{ width: 36, height: 36, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Dishes</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
              <Search size={15} color={C.muted} />
              <input
                type="text"
                value={adminDishSearch}
                onChange={(e) => setAdminDishSearch(e.target.value)}
                placeholder="Search by dish name or cook…"
                style={{ flex: 1, border: 'none', outline: 'none', font: `400 13px ${font.sans}`, background: 'transparent' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adminDishes.map(d => (
                <div key={d.id} style={{ background: C.card, borderRadius: 12, padding: 10, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', flex: 'none' }}>
                    {d.photo_url ? (
                      <div style={{ width: '100%', height: '100%', backgroundImage: `url(${d.photo_url})`, backgroundSize: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#ece3d5,#ece3d5 9px,#f2ebde 9px,#f2ebde 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{d.emoji}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `500 13px ${font.serif}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ font: `400 10.5px ${font.sans}`, color: C.muted, marginTop: 2 }}>
                      {d.seller_name} · ${Number(d.price).toFixed(2)}
                      {!d.photo_url && <span style={{ color: '#c94b4b', marginLeft: 6 }}>· no photo</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => adminDeleteDishAction(d.id)}
                    disabled={adminActionSubmitting}
                    style={{ padding: 6, color: '#c94b4b', display: 'flex', alignItems: 'center' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {adminDishes.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: C.muted, font: `400 13px ${font.sans}` }}>
                  No dishes found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= RADIUS PANEL (feed proximity) ================= */}
        {showRadiusPanel && (
          <div
            onClick={() => setShowRadiusPanel(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(30,15,5,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1400, animation: 'plfade .25s ease' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 22px 24px', width: '100%', maxWidth: 430, boxShadow: '0 -8px 30px rgba(0,0,0,.2)' }}
            >
              <div style={{ width: 44, height: 4, background: C.divider, borderRadius: 2, margin: '0 auto 14px' }} />
              <div style={{ font: `500 18px ${font.serif}`, color: C.ink, marginBottom: 4 }}>How far should we look?</div>
              <div style={{ font: `400 12.5px ${font.sans}`, color: C.muted, marginBottom: 18 }}>
                Only see posts from cooks within this distance.
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <div style={{ font: `600 40px ${font.serif}`, color: C.terracotta, lineHeight: 1 }}>
                  {feedRadiusMi < 1 ? feedRadiusMi.toFixed(1) : Math.round(feedRadiusMi)}
                </div>
                <div style={{ font: `500 14px ${font.sans}`, color: C.muted }}>miles</div>
              </div>

              {/* Slider — 0.5 → 50 mi. We use a log-ish curve so lower ranges get more granularity. */}
              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={feedRadiusMi}
                onChange={(e) => setFeedRadiusMi(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: C.terracotta }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, font: `400 10.5px ${font.sans}`, color: C.muted }}>
                <span>0.5 mi</span>
                <span>10 mi</span>
                <span>25 mi</span>
                <span>50 mi</span>
              </div>

              {/* Quick presets */}
              <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Walk (0.5)', val: 0.5 },
                  { label: 'Bike (2)', val: 2 },
                  { label: 'Nearby (5)', val: 5 },
                  { label: 'Cross-town (15)', val: 15 },
                  { label: 'Metro (50)', val: 50 },
                ].map(p => (
                  <button
                    key={p.val}
                    onClick={() => setFeedRadiusMi(p.val)}
                    style={{
                      padding: '7px 12px',
                      background: feedRadiusMi === p.val ? C.ink : C.surface,
                      color: feedRadiusMi === p.val ? '#fff' : C.inkSoft,
                      border: `1px solid ${feedRadiusMi === p.val ? C.ink : C.divider}`,
                      borderRadius: 16,
                      font: `500 11.5px ${font.sans}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowRadiusPanel(false)}
                style={{ width: '100%', padding: 14, background: C.terracotta, color: '#fff', borderRadius: 14, font: `500 14px ${font.sans}`, marginTop: 18 }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ================= NEARBY RADIUS PANEL (Discover dish feed) ================= */}
        {showNearbyPanel && (
          <div
            onClick={() => setShowNearbyPanel(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(30,15,5,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1400, animation: 'plfade .25s ease' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 22px 24px', width: '100%', maxWidth: 430, boxShadow: '0 -8px 30px rgba(0,0,0,.2)' }}
            >
              <div style={{ width: 44, height: 4, background: C.divider, borderRadius: 2, margin: '0 auto 14px' }} />
              <div style={{ font: `500 18px ${font.serif}`, color: C.ink, marginBottom: 4 }}>How far should we look?</div>
              <div style={{ font: `400 12.5px ${font.sans}`, color: C.muted, marginBottom: 18 }}>
                Only show dishes from cooks within this distance.
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <div style={{ font: `600 40px ${font.serif}`, color: C.terracotta, lineHeight: 1 }}>
                  {nearbyRadiusMi < 1 ? nearbyRadiusMi.toFixed(1) : Math.round(nearbyRadiusMi)}
                </div>
                <div style={{ font: `500 14px ${font.sans}`, color: C.muted }}>miles</div>
              </div>

              <input
                type="range"
                min={0.5}
                max={50}
                step={0.5}
                value={nearbyRadiusMi}
                onChange={(e) => setNearbyRadiusMi(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: C.terracotta }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, font: `400 10.5px ${font.sans}`, color: C.muted }}>
                <span>0.5 mi</span>
                <span>10 mi</span>
                <span>25 mi</span>
                <span>50 mi</span>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Walk (0.5)', val: 0.5 },
                  { label: 'Bike (2)', val: 2 },
                  { label: 'Nearby (10)', val: 10 },
                  { label: 'Cross-town (15)', val: 15 },
                  { label: 'Metro (50)', val: 50 },
                ].map(p => (
                  <button
                    key={p.val}
                    onClick={() => setNearbyRadiusMi(p.val)}
                    style={{
                      padding: '7px 12px',
                      background: nearbyRadiusMi === p.val ? C.ink : C.surface,
                      color: nearbyRadiusMi === p.val ? '#fff' : C.inkSoft,
                      border: `1px solid ${nearbyRadiusMi === p.val ? C.ink : C.divider}`,
                      borderRadius: 16,
                      font: `500 11.5px ${font.sans}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowNearbyPanel(false)}
                style={{ width: '100%', padding: 14, background: C.terracotta, color: '#fff', borderRadius: 14, font: `500 14px ${font.sans}`, marginTop: 18 }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* ================= FILTER PANEL ================= */}
        {showFilterPanel && (
          <div
            onClick={() => setShowFilterPanel(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(30,15,5,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1400, animation: 'plfade .25s ease' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 22px 24px', width: '100%', maxWidth: 430, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 30px rgba(0,0,0,.2)' }}
            >
              <div style={{ width: 44, height: 4, background: C.divider, borderRadius: 2, margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ font: `500 20px ${font.serif}`, color: C.ink }}>Filters</div>
                {activeFilterCount > 0 && (
                  <button onClick={clearFilters} style={{ padding: '6px 12px', background: 'transparent', color: C.terracotta, font: `500 12.5px ${font.sans}` }}>
                    Clear all
                  </button>
                )}
              </div>

              {/* Distance */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Distance</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { key: 'any', label: 'Any' },
                    { key: '1mi', label: 'Within 1 mi' },
                    { key: '3mi', label: 'Within 3 mi' },
                    { key: '5mi', label: 'Within 5 mi' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setDistanceFilter(opt.key)}
                      style={{
                        padding: '8px 14px',
                        background: distanceFilter === opt.key ? C.ink : C.surface,
                        color: distanceFilter === opt.key ? '#fff' : C.inkSoft,
                        border: `1px solid ${distanceFilter === opt.key ? C.ink : C.divider}`,
                        borderRadius: 16,
                        font: `500 12px ${font.sans}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {distanceFilter !== 'any' && (user.latitude == null || user.longitude == null) && (
                  <div style={{ marginTop: 8, font: `400 11px ${font.sans}`, color: '#8a2a2a' }}>
                    Location not set — distance filter won&apos;t match any dishes. Enable location on your profile.
                  </div>
                )}
              </div>

              {/* Rating */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Rating</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {([
                    { key: 'any', label: 'Any' },
                    { key: '4plus', label: '4+ stars' },
                    { key: '4half', label: '4.5+ stars' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setRatingFilter(opt.key)}
                      style={{
                        padding: '8px 14px',
                        background: ratingFilter === opt.key ? C.ink : C.surface,
                        color: ratingFilter === opt.key ? '#fff' : C.inkSoft,
                        border: `1px solid ${ratingFilter === opt.key ? C.ink : C.divider}`,
                        borderRadius: 16,
                        font: `500 12px ${font.sans}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      {opt.key !== 'any' && <Star size={11} fill={ratingFilter === opt.key ? '#fff' : C.gold} color={ratingFilter === opt.key ? '#fff' : C.gold} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary tags */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Kitchen tags</div>
                {availableDietaryTags.length === 0 ? (
                  <div style={{ font: `400 12px ${font.sans}`, color: C.muted }}>
                    No cooks have set dietary tags yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {availableDietaryTags.map(tag => {
                      const selected = dietaryFilter.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => toggleDietaryTag(tag)}
                          style={{
                            padding: '8px 14px',
                            background: selected ? C.ink : C.surface,
                            color: selected ? '#fff' : C.inkSoft,
                            border: `1px solid ${selected ? C.ink : C.divider}`,
                            borderRadius: 16,
                            font: `500 12px ${font.sans}`,
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowFilterPanel(false)}
                style={{ width: '100%', padding: 14, background: C.terracotta, color: '#fff', borderRadius: 14, font: `500 14px ${font.sans}`, marginTop: 8 }}
              >
                Show {filteredDishes.length} {filteredDishes.length === 1 ? 'result' : 'results'}
              </button>
            </div>
          </div>
        )}

        {/* ================= RATING MODAL ================= */}
        {pendingRating && (
          <div
            onClick={dismissRating}
            style={{ position: 'fixed', inset: 0, background: 'rgba(30,15,5,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1500, animation: 'plfade .25s ease' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ background: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '20px 22px 24px', width: '100%', maxWidth: 430, boxShadow: '0 -8px 30px rgba(0,0,0,.2)' }}
            >
              <div style={{ width: 44, height: 4, background: C.divider, borderRadius: 2, margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 12, overflow: 'hidden', flex: 'none' }}>
                  {pendingRating.dish_photo_url ? (
                    <div style={{ width: '100%', height: '100%', backgroundImage: `url(${pendingRating.dish_photo_url})`, backgroundSize: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#ece3d5,#ece3d5 9px,#f2ebde 9px,#f2ebde 18px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{pendingRating.dish_emoji}</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: `500 12px ${font.sans}`, color: C.muted }}>How was your order?</div>
                  <div style={{ font: `500 16px/1.15 ${font.serif}`, color: C.ink, marginTop: 2 }}>{pendingRating.dish_name}</div>
                  <div style={{ font: `400 11.5px ${font.sans}`, color: C.muted, marginTop: 2 }}>
                    from {pendingRating.seller_kitchen_name || pendingRating.seller_name}
                  </div>
                </div>
              </div>

              {/* Star input */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '14px 0', background: C.surface, borderRadius: 14, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setRatingStars(n)}
                    disabled={ratingSubmitting}
                    style={{ padding: 4 }}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    <Star
                      size={38}
                      fill={n <= ratingStars ? C.gold : 'none'}
                      color={n <= ratingStars ? C.gold : C.mutedLight}
                      strokeWidth={2}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Add a comment (optional)…"
                rows={3}
                maxLength={500}
                disabled={ratingSubmitting}
                style={{ width: '100%', padding: 12, border: `1px solid ${C.divider}`, borderRadius: 12, font: `400 13.5px/1.4 ${font.sans}`, background: '#fff', resize: 'none', outline: 'none', marginBottom: 12 }}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={dismissRating}
                  disabled={ratingSubmitting}
                  style={{ flex: 1, padding: 12, background: 'transparent', color: C.muted, borderRadius: 12, font: `500 13px ${font.sans}` }}
                >
                  Later
                </button>
                <button
                  onClick={submitRating}
                  disabled={!ratingStars || ratingSubmitting}
                  style={{ flex: 2, padding: 12, background: ratingStars && !ratingSubmitting ? C.terracotta : C.cardAlt, color: ratingStars && !ratingSubmitting ? '#fff' : C.mutedLight, borderRadius: 12, font: `500 13.5px ${font.sans}` }}
                >
                  {ratingSubmitting ? 'Submitting…' : 'Submit rating'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 100, background: C.ink, color: '#fff', padding: '12px 20px', borderRadius: 14, font: `500 13px ${font.sans}`, animation: 'pltoast 2.4s ease', boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 1000 }}>
            {toast}
          </div>
        )}

      </div>
    </div>
  );
}
