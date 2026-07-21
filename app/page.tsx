'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, ShoppingBag, ChefHat, Bell, X, Plus, MapPin, Camera, ArrowLeft, Search, Compass, Receipt, User as UserIcon, Minus, Trash2, Map as MapIcon, Navigation } from 'lucide-react';
import MapView from '@/components/MapView';
import AddressAutocomplete from '@/components/AddressAutocomplete';

interface Dish {
  id: number;
  name: string;
  seller_name: string;
  seller_avatar: string;
  seller_photo_url: string | null;
  seller_latitude: number | null;
  seller_longitude: number | null;
  seller_kitchen_flags: string | null;
  seller_pickup_description: string | null;
  seller_cooking_hours: string | null;
  emoji: string;
  photo_url: string | null;
  price: number;
  likes: number;
  description: string;
  liked?: boolean;
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
}

interface Order {
  id: string;
  dish: Dish;
  quantity: number;
  total: string;
  status: 'processing' | 'ready';
  createdAt: Date;
}

interface Notification {
  id: number;
  type: 'payment' | 'ready';
  message: string;
}

interface User {
  id: number;
  name: string;
  isSeller: boolean;
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
  cooking_hours: string | null;
  pickup_description: string | null;
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
  const [screen, setScreen] = useState<'feed' | 'meal' | 'cart' | 'profile' | 'seller-dashboard' | 'cook-profile' | 'notifications'>('feed');
  const [user, setUser] = useState<User | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [mealQty, setMealQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myDishes, setMyDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [dishPhotoFile, setDishPhotoFile] = useState<File | null>(null);
  const [dishPhotoPreview, setDishPhotoPreview] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [tipAmount, setTipAmount] = useState(3);
  const [tipEditing, setTipEditing] = useState(false);
  const [pickupTiming, setPickupTiming] = useState<'asap' | 'schedule'>('asap');
  const [toast, setToast] = useState<string | null>(null);
  const [feedView, setFeedView] = useState<'list' | 'map'>('list');
  const [showingDirections, setShowingDirections] = useState(false);
  const [tripInfo, setTripInfo] = useState<{ distanceText: string; durationText: string } | null>(null);

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
  const [cpCookingHours, setCpCookingHours] = useState('');
  const [cpPickupDesc, setCpPickupDesc] = useState('');
  const [cpSaving, setCpSaving] = useState(false);

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

  useEffect(() => {
    const initApp = async () => {
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'init' }),
        });

        let currentUser: User | null = null;
        const storedUserId = localStorage.getItem('plates_user_id');

        if (storedUserId && storedUserId !== 'undefined' && storedUserId !== 'null') {
          const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', id: storedUserId }),
          });
          currentUser = await res.json();
        } else {
          const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              name: 'You',
              email: `user_${Date.now()}@plates.local`,
              avatar: 'Y',
            }),
          });
          currentUser = await res.json();
          if (currentUser) localStorage.setItem('plates_user_id', String(currentUser.id));
        }

        setUser(currentUser);
        if (currentUser) {
          setProfileName(currentUser.name);
          setProfileBio(currentUser.bio || '');
          loadCart(currentUser.id);
        }

        const dishRes = await fetch('/api/dishes?action=getAll');
        const dishData = await dishRes.json();
        setDishes(Array.isArray(dishData) ? dishData : []);

        if (currentUser && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords;
              try {
                const res = await fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'updateLocation',
                    id: currentUser!.id,
                    latitude, longitude,
                  }),
                });
                const updated = await res.json();
                setUser(updated);
              } catch (e) { console.error(e); }
            },
            () => {},
            { timeout: 8000 }
          );
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

  const placeOrder = async () => {
    if (!user || cart.length === 0) return;
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkout',
          buyerId: user.id,
          tipAmount,
          serviceFee,
        }),
      });
      const result = await res.json();

      const cartSnapshot = [...cart];
      const totalSnapshot = cartTotal;

      setCart([]);
      setScreen('feed');
      showToast(`Order placed · $${totalSnapshot.toFixed(2)}`);

      setTimeout(() => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'payment',
          message: `✓ Paid $${totalSnapshot.toFixed(2)} for ${cartCount} item${cartCount > 1 ? 's' : ''}`,
        }]);
      }, 800);

      const firstSeller = cartSnapshot[0]?.seller_name || 'the cook';
      setTimeout(() => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'ready',
          message: `🔔 Your order is ready for pickup at ${firstSeller}'s kitchen!`,
        }]);
      }, 3000);
    } catch (error) {
      console.error('Checkout error:', error);
    }
  };

  const handleDishPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDishPhotoFile(file);
    setDishPhotoPreview(URL.createObjectURL(file));
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

  const removeDish = async (dishId: number) => {
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
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleSeller', id: user.id, isSeller: !user.isSeller }),
      });
      const updatedUser = await res.json();
      setUser(updatedUser);
      if (!user.isSeller) setScreen('seller-dashboard');
    } catch (error) { console.error(error); }
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
      () => {},
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
          cookingHours: cpCookingHours || null,
          pickupDescription: cpPickupDesc || null,
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.page, color: C.muted }}>
        <div style={{ textAlign: 'center' }}>
          <ChefHat size={44} style={{ marginBottom: 14, color: C.terracotta, opacity: .8 }} />
          <p style={{ fontFamily: font.sans, fontSize: 15 }}>Starting your kitchen…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const heroDish = dishes[0] || null;
  const otherDishes = dishes.slice(heroDish ? 1 : 0);

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

  return (
    <div style={{ background: C.page, minHeight: '100vh', fontFamily: font.sans, color: C.ink }}>
      <div style={{ maxWidth: 430, margin: '0 auto', background: C.surface, minHeight: '100vh', position: 'relative' }}>

        {/* ================= DISCOVER ================= */}
        {screen === 'feed' && (
          <div style={{ animation: 'plfade .3s ease', paddingBottom: 100 }}>
            <div style={{ padding: '20px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ font: `500 25px/1 ${font.serif}`, color: C.terracotta, letterSpacing: '-.01em' }}>Plates</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {user.latitude != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.cardAlt, padding: '7px 11px', borderRadius: 20, font: `500 12px ${font.sans}`, color: C.inkSoft }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                    Nearby ▾
                  </div>
                )}
                <button onClick={() => setScreen('notifications')} style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: C.cardAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft }}>
                  <Bell size={17} />
                  {notifications.length > 0 && (
                    <span style={{ position: 'absolute', top: 6, right: 7, minWidth: 14, height: 14, padding: '0 4px', borderRadius: 8, background: C.terracotta, color: '#fff', font: `500 9px ${font.sans}`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${C.surface}` }}>{notifications.length}</span>
                  )}
                </button>
              </div>
            </div>

            <div style={{ padding: '12px 20px 0' }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10, color: C.muted, font: `400 13.5px ${font.sans}`, boxShadow: '0 2px 10px rgba(60,40,20,.06)' }}>
                <Search size={15} color={C.terracotta} strokeWidth={2.5} />
                Search dishes, cooks, cuisines…
              </div>
            </div>

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
                      {user.latitude != null && heroDish.seller_latitude != null && heroDish.seller_longitude != null && user.longitude != null && (
                        <> · {distanceMiles(user.latitude, user.longitude, heroDish.seller_latitude, heroDish.seller_longitude).toFixed(1)} mi</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 12px' }}>
              <div style={{ font: `500 19px/1 ${font.serif}`, color: C.ink }}>Fresh from the block</div>
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

            {feedView === 'map' ? (
              <div style={{ padding: '0 20px 8px' }}>
                <MapView
                  height={380}
                  radius={18}
                  userLat={user.latitude}
                  userLng={user.longitude}
                  pins={dishes
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
                {dishes.filter(d => d.seller_latitude != null).length === 0 && dishes.length > 0 && (
                  <div style={{ marginTop: 10, padding: 12, background: C.card, borderRadius: 12, font: `400 12px ${font.sans}`, color: C.muted, textAlign: 'center' }}>
                    No cooks have shared a location yet. Ask cooks to enable location in their kitchen setup.
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6, color: C.muted, font: `400 12px ${font.sans}` }}>
                          {dish.seller_photo_url ? (
                            <span style={{ width: 17, height: 17, borderRadius: '50%', backgroundImage: `url(${dish.seller_photo_url})`, backgroundSize: 'cover' }} />
                          ) : (
                            <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#e7dcc9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, font: `500 9px ${font.sans}` }}>{dish.seller_avatar}</span>
                          )}
                          {dish.seller_name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                          {dist !== null && (
                            <span style={{ background: C.greenLight, color: C.green, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>{dist < 0.1 ? 'nearby' : `${dist.toFixed(1)} mi`} · {etaMinutes(dist)} min</span>
                          )}
                          <span style={{ background: C.terracottaLight, color: C.terracotta, padding: '4px 9px', borderRadius: 8, font: `500 10.5px ${font.sans}` }}>♥ {dish.likes}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ padding: '18px 20px 26px' }}>
              <div onClick={toggleSellerMode} style={{ cursor: 'pointer', background: C.green, borderRadius: 20, padding: '17px 18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ font: `500 16px/1.1 ${font.serif}` }}>Are you a home cook?</div>
                  <div style={{ font: `400 12px ${font.sans}`, opacity: .85, marginTop: 4 }}>Post today's plate in minutes.</div>
                </div>
                <div style={{ background: '#fff', color: C.green, padding: '10px 15px', borderRadius: 13, font: `500 12.5px ${font.sans}` }}>{user.isSeller ? 'Kitchen' : 'Start cooking'}</div>
              </div>
            </div>
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
                    {distanceMiles(user.latitude, user.longitude, selectedDish.seller_latitude, selectedDish.seller_longitude).toFixed(1)} mi · pickup ~{etaMinutes(distanceMiles(user.latitude, user.longitude, selectedDish.seller_latitude, selectedDish.seller_longitude))} min
                  </span>
                )}
                <span style={{ background: C.cardAlt, color: C.inkSoft, padding: '5px 10px', borderRadius: 8, font: `500 11px ${font.sans}` }}>Homemade</span>
              </div>

              {selectedDish.description && (
                <div style={{ font: `400 13.5px/1.6 ${font.sans}`, color: C.inkSoft, marginTop: 18 }}>
                  {selectedDish.description}
                </div>
              )}

              <div style={{ marginTop: 22, background: C.card, borderRadius: 14, padding: 14, border: `1px solid ${C.cardAlt}` }}>
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
                </div>
                {selectedDish.seller_kitchen_flags && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                    {selectedDish.seller_kitchen_flags.split(',').map(f => f.trim()).filter(Boolean).map(flag => (
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
                  <div style={{ font: `500 13px ${font.sans}`, color: C.inkSoft, marginBottom: 8 }}>Ready by</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setPickupTiming('asap')} style={{ flex: 1, background: pickupTiming === 'asap' ? C.terracotta : C.card, color: pickupTiming === 'asap' ? '#fff' : C.inkSoft, borderRadius: 11, padding: 10, font: `500 12px ${font.sans}`, boxShadow: pickupTiming === 'asap' ? 'none' : '0 2px 8px rgba(60,40,20,.05)' }}>
                      ASAP · ~25 min
                    </button>
                    <button onClick={() => setPickupTiming('schedule')} style={{ flex: 1, background: pickupTiming === 'schedule' ? C.terracotta : C.card, color: pickupTiming === 'schedule' ? '#fff' : C.inkSoft, borderRadius: 11, padding: 10, font: `500 12px ${font.sans}`, boxShadow: pickupTiming === 'schedule' ? 'none' : '0 2px 8px rgba(60,40,20,.05)' }}>
                      Schedule
                    </button>
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
              <div style={{ font: `500 22px ${font.serif}`, color: C.ink }}>Your profile</div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: user.isSeller ? 12 : 0 }}>
                <span style={{ font: `400 14px ${font.sans}`, color: C.inkSoft }}>Seller mode</span>
                <button onClick={toggleSellerMode} style={{ width: 48, height: 28, borderRadius: 14, background: user.isSeller ? C.green : C.divider, position: 'relative', transition: 'all .3s' }}>
                  <div style={{ position: 'absolute', width: 24, height: 24, background: '#fff', borderRadius: '50%', top: 2, left: user.isSeller ? 22 : 2, transition: 'left .3s' }} />
                </button>
              </div>
              {user.isSeller && (
                <button onClick={() => setScreen('seller-dashboard')} style={{ width: '100%', padding: 10, background: C.terracotta, color: '#fff', borderRadius: 10, font: `500 14px ${font.sans}` }}>
                  Go to kitchen
                </button>
              )}
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

            {(() => {
              const filled = [
                user.legal_name, user.kitchen_name, user.cottage_food_attested,
                user.has_permit != null, user.kitchen_flags, user.cooking_hours, user.pickup_description,
              ].filter(Boolean).length;
              const total = 7;
              const pct = Math.round((filled / total) * 100);
              const complete = filled === total;
              return (
                <div onClick={openCookProfile} style={{ cursor: 'pointer', background: complete ? C.greenLight : C.card, borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 8px rgba(60,40,20,.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: complete ? C.green : C.cardAlt, color: complete ? '#fff' : C.inkSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <ChefHat size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: `500 15px ${font.serif}`, color: complete ? C.green : C.ink }}>
                      {complete ? 'Kitchen profile complete' : 'Complete your kitchen profile'}
                    </div>
                    <div style={{ font: `400 11.5px ${font.sans}`, color: complete ? C.green : C.muted, marginTop: 2 }}>
                      {complete ? 'Buyers see all your details' : `${filled} of ${total} sections done · ${pct}%`}
                    </div>
                    {!complete && (
                      <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: C.cardAlt, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.terracotta }} />
                      </div>
                    )}
                  </div>
                  <div style={{ color: complete ? C.green : C.terracotta, font: `500 12px ${font.sans}`, flex: 'none' }}>{complete ? 'Edit' : 'Set up ›'}</div>
                </div>
              );
            })()}

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

            <div style={{ marginBottom: 16 }}>
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

            {myDishes.length > 0 && (
              <div>
                <div style={{ font: `500 16px ${font.serif}`, color: C.ink, marginBottom: 10 }}>Your menu</div>
                {myDishes.map(dish => (
                  <div key={dish.id} style={{ background: C.card, padding: 10, borderRadius: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, boxShadow: '0 2px 8px rgba(60,40,20,.05)' }}>
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
              <div style={{ font: `500 15px ${font.serif}`, color: C.ink, marginBottom: 4 }}>Kitchen environment</div>
              <div style={{ font: `400 12px ${font.sans}`, color: C.muted, marginBottom: 14 }}>Shown to buyers on your dishes so they can decide what's right for them.</div>

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
        {(screen === 'feed' || screen === 'cart') && (
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: C.card, borderTop: `1px solid ${C.hairline}`, display: 'flex', justifyContent: 'space-around', padding: '10px 0 14px', maxWidth: 430, margin: '0 auto' }}>
            <button onClick={() => setScreen('feed')} style={{ textAlign: 'center', color: screen === 'feed' ? C.terracotta : C.mutedLight, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <Compass size={22} strokeWidth={screen === 'feed' ? 2.5 : 2} />
              <span style={{ font: `500 10px ${font.sans}` }}>Discover</span>
            </button>
            <button onClick={() => setScreen('cart')} style={{ textAlign: 'center', color: screen === 'cart' ? C.terracotta : C.mutedLight, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <ShoppingBag size={22} strokeWidth={screen === 'cart' ? 2.5 : 2} />
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
