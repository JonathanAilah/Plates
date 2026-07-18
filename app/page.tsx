'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Heart, ShoppingBag, ChefHat, Bell, X, Plus, MapPin, Camera } from 'lucide-react';

interface Dish {
  id: number;
  name: string;
  seller_name: string;
  seller_avatar: string;
  seller_photo_url: string | null;
  seller_latitude: number | null;
  seller_longitude: number | null;
  emoji: string;
  photo_url: string | null;
  price: number;
  likes: number;
  description: string;
  liked?: boolean;
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

async function uploadImage(file: File): Promise<string | null> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url ?? null;
}

export default function Home() {
  const [screen, setScreen] = useState<'feed' | 'profile' | 'order' | 'seller-dashboard' | 'notifications'>('feed');
  const [user, setUser] = useState<User | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [myDishes, setMyDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [dishPhotoFile, setDishPhotoFile] = useState<File | null>(null);
  const [dishPhotoPreview, setDishPhotoPreview] = useState<string | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const dishFileInputRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

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
          if (currentUser) {
            localStorage.setItem('plates_user_id', String(currentUser.id));
          }
        }

        setUser(currentUser);
        if (currentUser) {
          setProfileName(currentUser.name);
          setProfileBio(currentUser.bio || '');
        }

        const dishRes = await fetch('/api/dishes?action=getAll');
        const dishData = await dishRes.json();
        setDishes(Array.isArray(dishData) ? dishData : []);

        if (currentUser && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords;
              setLocationStatus('granted');
              try {
                const res = await fetch('/api/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'updateLocation',
                    id: currentUser!.id,
                    latitude,
                    longitude,
                  }),
                });
                const updated = await res.json();
                setUser(updated);
              } catch (e) {
                console.error('Location save error:', e);
              }
            },
            () => setLocationStatus('denied'),
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
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleOrderClick = (dish: Dish) => {
    setSelectedDish(dish);
    setQuantity(1);
    setScreen('order');
  };

  const processOrder = async () => {
    if (!selectedDish || !user) return;
    try {
      const totalPrice = (selectedDish.price * quantity).toFixed(2);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          buyerId: user.id,
          dishId: selectedDish.id,
          quantity,
          totalPrice,
        }),
      });

      const order = await res.json();

      setOrders([...orders, {
        id: order.id,
        dish: selectedDish,
        quantity,
        total: totalPrice,
        status: 'processing',
        createdAt: new Date(),
      }]);

      setTimeout(() => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'payment',
          message: `✓ Paid $${totalPrice} for ${quantity}x ${selectedDish.name}`,
        }]);
      }, 800);

      setTimeout(() => {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'ready',
          message: `🔔 Order #${order.id.slice(0, 6)} ready for pickup at ${selectedDish.seller_name}'s kitchen!`,
        }]);
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'ready' } : o));
      }, 3000);

      setSelectedDish(null);
      setScreen('feed');
    } catch (error) {
      console.error('Order error:', error);
    }
  };

  const handleDishPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDishPhotoFile(file);
    setDishPhotoPreview(URL.createObjectURL(file));
  };

  const addDish = async (dishName: string) => {
    if (!user) return;
    try {
      const emojis = ['🍕', '🍔', '🌮', '🍝', '🥘', '🍗', '🍜', '🍰'];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const price = Math.floor(Math.random() * 10) + 8;

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
          price,
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
    } catch (error) {
      console.error('Add dish error:', error);
    }
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
    } catch (error) {
      console.error('Seller toggle error:', error);
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
          id: user.id,
          name: profileName,
          bio: profileBio,
          photoUrl,
        }),
      });
      const updated = await res.json();
      setUser(updated);
      setProfilePhotoFile(null);
      setProfilePhotoPreview(null);
    } catch (error) {
      console.error('Save profile error:', error);
    } finally {
      setSavingProfile(false);
    }
  };

  const requestLocation = () => {
    if (!user || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLocationStatus('granted');
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateLocation', id: user.id, latitude, longitude }),
        });
        const updated = await res.json();
        setUser(updated);
      },
      () => setLocationStatus('denied'),
      { timeout: 8000 }
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f5f5', fontSize: '18px', color: '#666' }}>
        <div style={{ textAlign: 'center' }}>
          <ChefHat size={48} style={{ marginBottom: '16px', opacity: 0.6 }} />
          <p>Starting your kitchen...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e0e0e0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChefHat size={24} style={{ color: '#d4704e' }} /> Plates
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={() => setScreen('notifications')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px', color: '#1a1a1a', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Bell size={20} />
            {notifications.length > 0 && (
              <span style={{ position: 'absolute', top: '4px', right: '4px', width: '8px', height: '8px', background: '#e74c3c', borderRadius: '50%' }} />
            )}
          </button>
          <button onClick={() => setScreen('profile')} style={{
            background: user.photo_url ? `url(${user.photo_url}) center/cover` : '#f0e6d2',
            color: '#8b6f47', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px',
            fontSize: '14px', fontWeight: 600, width: '32px', height: '32px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>{!user.photo_url && user.avatar}</button>
        </div>
      </div>

      {/* FEED */}
      {screen === 'feed' && (
        <div style={{ padding: '12px', maxWidth: '600px', margin: '0 auto' }}>
          {dishes.length === 0 && (
            <div style={{ textAlign: 'center', color: '#999', padding: '60px 20px' }}>
              <ChefHat size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <p>No dishes yet. Be the first to add one!</p>
            </div>
          )}
          {dishes.map(dish => {
            const dist = (user.latitude != null && user.longitude != null && dish.seller_latitude != null && dish.seller_longitude != null)
              ? distanceMiles(user.latitude, user.longitude, dish.seller_latitude, dish.seller_longitude)
              : null;
            return (
              <div key={dish.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ padding: '12px', display: 'flex', gap: '12px' }}>
                  <div style={{ width: '60px', height: '60px', background: '#f9f9f9', borderRadius: '8px', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {dish.photo_url ? (
                      <img src={dish.photo_url} alt={dish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : dish.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: '#999', marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span>{dish.seller_name}</span>
                      {dist !== null && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <MapPin size={12} /> {dist < 0.1 ? 'nearby' : `${dist.toFixed(1)} mi`}
                        </span>
                      )}
                    </div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>{dish.name}</h3>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666', lineHeight: '1.4' }}>{dish.description}</p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px', fontWeight: 600 }}>${dish.price}</span>
                      <span style={{ fontSize: '12px', color: '#999' }}>❤️ {dish.likes}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', padding: '0 12px 12px', background: '#fafafa' }}>
                  <button onClick={() => toggleLike(dish.id)} style={{ flex: 1, padding: '10px', background: dish.liked ? '#ffe6e6' : 'white', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: dish.liked ? '#e74c3c' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Heart size={16} fill={dish.liked ? 'currentColor' : 'none'} /> Like
                  </button>
                  <button onClick={() => handleOrderClick(dish)} style={{ flex: 1, padding: '10px', background: '#d4704e', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <ShoppingBag size={16} /> Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ORDER MODAL */}
      {screen === 'order' && selectedDish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 200 }}>
          <div style={{ width: '100%', background: 'white', borderRadius: '12px 12px 0 0', padding: '20px', borderTop: '1px solid #e0e0e0', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Order from {selectedDish.seller_name}</h2>
              <button onClick={() => setScreen('feed')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', background: 'white' }}>
                {selectedDish.photo_url ? (
                  <img src={selectedDish.photo_url} alt={selectedDish.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : selectedDish.emoji}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>{selectedDish.name}</div>
              <div style={{ fontSize: '14px', color: '#666' }}>{selectedDish.description}</div>
              {user.latitude != null && user.longitude != null && selectedDish.seller_latitude != null && selectedDish.seller_longitude != null && (
                <div style={{ fontSize: '13px', color: '#999', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <MapPin size={14} /> {distanceMiles(user.latitude, user.longitude, selectedDish.seller_latitude, selectedDish.seller_longitude).toFixed(1)} miles away for pickup
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Quantity</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ width: '40px', height: '40px', border: '1px solid #e0e0e0', background: '#f9f9f9', cursor: 'pointer', borderRadius: '6px', fontSize: '18px', fontWeight: 600 }}>−</button>
                <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} style={{ flex: 1, padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '16px', textAlign: 'center', background: '#f9f9f9' }} />
                <button onClick={() => setQuantity(quantity + 1)} style={{ width: '40px', height: '40px', border: '1px solid #e0e0e0', background: '#f9f9f9', cursor: 'pointer', borderRadius: '6px', fontSize: '18px', fontWeight: 600 }}>+</button>
              </div>
            </div>

            <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Total</span>
              <span style={{ fontSize: '20px', fontWeight: 600 }}>${(selectedDish.price * quantity).toFixed(2)}</span>
            </div>

            <button onClick={processOrder} style={{ width: '100%', padding: '12px', background: '#d4704e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px' }}>
              Proceed to Payment
            </button>
            <button onClick={() => setScreen('feed')} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '16px', cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {screen === 'notifications' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <button onClick={() => setScreen('feed')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '16px', color: '#1a1a1a', fontSize: '16px', fontWeight: 600 }}>&larr; Back</button>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 20px' }}>
              <Bell size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '12px', borderLeft: `4px solid ${notif.type === 'ready' ? '#27ae60' : '#3498db'}` }}>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', color: '#1a1a1a' }}>{notif.message}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* SELLER DASHBOARD */}
      {screen === 'seller-dashboard' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <button onClick={() => setScreen('feed')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '16px', color: '#1a1a1a', fontSize: '16px', fontWeight: 600 }}>&larr; Back</button>

          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Your Kitchen</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>You're selling {myDishes.length} {myDishes.length === 1 ? 'dish' : 'dishes'}</p>
            {user.latitude == null && (
              <button onClick={requestLocation} style={{ marginTop: '10px', padding: '8px 12px', background: '#fff8ee', border: '1px solid #f0d9b5', borderRadius: '6px', fontSize: '13px', color: '#8b6f47', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} /> Share your location so buyers know pickup distance
              </button>
            )}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>What are you cooking today?</label>
            <input type="text" id="dishName" placeholder="e.g., Homemade Pasta" style={{ width: '100%', padding: '12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', background: 'white', marginBottom: '8px', boxSizing: 'border-box' }} />

            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Photo (optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div onClick={() => dishFileInputRef.current?.click()} style={{ width: '64px', height: '64px', borderRadius: '8px', background: '#f9f9f9', border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}>
                {dishPhotoPreview ? (
                  <img src={dishPhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Camera size={20} style={{ color: '#999' }} />
                )}
              </div>
              <input ref={dishFileInputRef} type="file" accept="image/*" onChange={handleDishPhotoChange} style={{ display: 'none' }} />
              <span style={{ fontSize: '13px', color: '#999' }}>{dishPhotoFile ? dishPhotoFile.name : 'Tap to add a photo'}</span>
            </div>

            <button onClick={() => {
              const input = document.getElementById('dishName') as HTMLInputElement;
              if (input.value.trim()) {
                addDish(input.value.trim());
                input.value = '';
              }
            }} style={{ width: '100%', padding: '10px', background: '#d4704e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={16} /> Add to Menu
            </button>
          </div>

          {myDishes.length > 0 && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Your Menu</h3>
              {myDishes.map(dish => (
                <div key={dish.id} style={{ background: '#f9f9f9', padding: '12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', fontSize: '20px' }}>
                      {dish.photo_url ? <img src={dish.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : dish.emoji}
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>{dish.name}</div>
                      <div style={{ fontSize: '13px', color: '#999' }}>${dish.price}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#999' }}>❤️ {dish.likes}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROFILE */}
      {screen === 'profile' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <button onClick={() => setScreen('feed')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '16px', color: '#1a1a1a', fontSize: '16px', fontWeight: 600 }}>&larr; Back</button>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div onClick={() => profileFileInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f0e6d2', color: '#8b6f47', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 600, cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
              {profilePhotoPreview ? (
                <img src={profilePhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user.photo_url ? (
                <img src={user.photo_url} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : user.avatar}
              <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#d4704e', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={12} style={{ color: 'white' }} />
              </div>
            </div>
            <input ref={profileFileInputRef} type="file" accept="image/*" onChange={handleProfilePhotoChange} style={{ display: 'none' }} />
          </div>

          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#666' }}>Name</label>
            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#666' }}>Bio</label>
            <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} rows={2} style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
            <button onClick={saveProfile} disabled={savingProfile} style={{ width: '100%', padding: '10px', background: '#d4704e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> Location</span>
              {user.latitude != null ? (
                <span style={{ fontSize: '13px', color: '#27ae60', fontWeight: 600 }}>Shared</span>
              ) : (
                <button onClick={requestLocation} style={{ padding: '6px 12px', background: '#fff8ee', border: '1px solid #f0d9b5', borderRadius: '6px', fontSize: '13px', color: '#8b6f47', cursor: 'pointer' }}>
                  Share location
                </button>
              )}
            </div>
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e0e0e0', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Seller Mode</span>
              <button onClick={toggleSellerMode} style={{ width: '48px', height: '28px', borderRadius: '14px', background: user.isSeller ? '#27ae60' : '#e0e0e0', border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.3s' }}>
                <div style={{ position: 'absolute', width: '24px', height: '24px', background: 'white', borderRadius: '50%', top: '2px', left: user.isSeller ? '22px' : '2px', transition: 'left 0.3s' }} />
              </button>
            </div>
            {user.isSeller && (
              <button onClick={() => setScreen('seller-dashboard')} style={{ width: '100%', padding: '10px', background: '#d4704e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Go to Kitchen
              </button>
            )}
          </div>

          <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>Orders Placed: {orders.length}</div>
            <div style={{ fontSize: '14px', color: '#666' }}>Total Spent: ${orders.reduce((sum, o) => sum + parseFloat(o.total), 0).toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
