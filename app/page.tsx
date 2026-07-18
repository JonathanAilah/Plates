'use client';

import React, { useState, useEffect } from 'react';
import { Heart, ShoppingBag, User, ChefHat, Bell, X, Plus } from 'lucide-react';

interface Dish {
  id: number;
  name: string;
  seller_name: string;
  seller_avatar: string;
  emoji: string;
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

  useEffect(() => {
    const initApp = async () => {
      try {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'init' }),
        });

        const storedUserId = localStorage.getItem('plates_user_id');
        if (storedUserId && storedUserId !== 'undefined' && storedUserId !== 'null') {
          const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', id: storedUserId }),
          });
          const userData = await res.json();
          setUser(userData);
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
          const userData = await res.json();
          setUser(userData);
          localStorage.setItem('plates_user_id', userData.id);
        }

        const dishRes = await fetch('/api/dishes?action=getAll');
        const dishData = await dishRes.json();
        setDishes(dishData);
      } catch (error) {
        console.error('Init error:', error);
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
        body: JSON.stringify({
          action: 'toggleLike',
          userId: user.id,
          dishId,
        }),
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
        setOrders(prev => prev.map(o =>
          o.id === order.id ? { ...o, status: 'ready' } : o
        ));
      }, 3000);

      setSelectedDish(null);
      setScreen('feed');
    } catch (error) {
      console.error('Order error:', error);
    }
  };

  const addDish = async (dishName: string) => {
    if (!user) return;

    try {
      const emojis = ['🍕', '🍔', '🌮', '🍝', '🥘', '🍗', '🍜', '🍰'];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const price = Math.floor(Math.random() * 10) + 8;

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
        }),
      });

      const newDish = await res.json();
      setMyDishes([...myDishes, newDish]);
      setDishes([{ ...newDish, seller_name: user.name, seller_avatar: user.avatar }, ...dishes]);
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
        body: JSON.stringify({
          action: 'toggleSeller',
          id: user.id,
          isSeller: !user.isSeller,
        }),
      });

      const updatedUser = await res.json();
      setUser(updatedUser);
      if (!user.isSeller) setScreen('seller-dashboard');
    } catch (error) {
      console.error('Seller toggle error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f5f5f5',
        fontSize: '18px',
        color: '#666',
      }}>
        <div style={{ textAlign: 'center' }}>
          <ChefHat size={48} style={{ marginBottom: '16px', opacity: 0.6 }} />
          <p>Starting your kitchen...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{
      background: '#f5f5f5',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#1a1a1a',
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <ChefHat size={24} style={{ color: '#d4704e' }} /> Plates
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={() => setScreen('notifications')} style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: '#1a1a1a',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Bell size={20} />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
                background: '#e74c3c',
                borderRadius: '50%',
              }} />
            )}
          </button>
          <button onClick={() => setScreen('profile')} style={{
            background: '#f0e6d2',
            color: '#8b6f47',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>{user.avatar}</button>
        </div>
      </div>

      {/* FEED */}
      {screen === 'feed' && (
        <div style={{ padding: '12px', maxWidth: '600px', margin: '0 auto' }}>
          {dishes.map(dish => (
            <div key={dish.id} style={{
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e0e0e0',
              overflow: 'hidden',
              marginBottom: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{ padding: '12px', display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  background: '#f9f9f9',
                  borderRadius: '8px',
                  fontSize: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>{dish.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#999', marginBottom: '4px' }}>
                    {dish.seller_name}
                  </div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                    {dish.name}
                  </h3>
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '13px',
                    color: '#666',
                    lineHeight: '1.4',
                  }}>
                    {dish.description}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>${dish.price}</span>
                    <span style={{ fontSize: '12px', color: '#999' }}>❤️ {dish.likes}</span>
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '0 12px 12px',
                background: '#fafafa',
              }}>
                <button onClick={() => toggleLike(dish.id)} style={{
                  flex: 1,
                  padding: '10px',
                  background: dish.liked ? '#ffe6e6' : 'white',
                  border: '1px solid #e0e0e0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: dish.liked ? '#e74c3c' : '#1a1a1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}>
                  <Heart size={16} fill={dish.liked ? 'currentColor' : 'none'} /> Like
                </button>
                <button onClick={() => handleOrderClick(dish)} style={{
                  flex: 1,
                  padding: '10px',
                  background: '#d4704e',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}>
                  <ShoppingBag size={16} /> Order
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ORDER MODAL */}
      {screen === 'order' && selectedDish && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'flex-end',
          zIndex: 200,
        }}>
          <div style={{
            width: '100%',
            background: 'white',
            borderRadius: '12px 12px 0 0',
            padding: '20px',
            borderTop: '1px solid #e0e0e0',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
                Order from {selectedDish.seller_name}
              </h2>
              <button onClick={() => setScreen('feed')} style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}>
                <X size={20} />
              </button>
            </div>

            <div style={{
              background: '#f9f9f9',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>{selectedDish.emoji}</div>
              <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                {selectedDish.name}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>{selectedDish.description}</div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 600,
              }}>
                Quantity
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{
                  width: '40px',
                  height: '40px',
                  border: '1px solid #e0e0e0',
                  background: '#f9f9f9',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontSize: '18px',
                  fontWeight: 600,
                }}>−</button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    fontSize: '16px',
                    textAlign: 'center',
                    background: '#f9f9f9',
                  }}
                />
                <button onClick={() => setQuantity(quantity + 1)} style={{
                  width: '40px',
                  height: '40px',
                  border: '1px solid #e0e0e0',
                  background: '#f9f9f9',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  fontSize: '18px',
                  fontWeight: 600,
                }}>+</button>
              </div>
            </div>

            <div style={{
              background: '#f9f9f9',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Total</span>
              <span style={{ fontSize: '20px', fontWeight: 600 }}>
                ${(selectedDish.price * quantity).toFixed(2)}
              </span>
            </div>

            <button onClick={processOrder} style={{
              width: '100%',
              padding: '12px',
              background: '#d4704e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '8px',
            }}>
              Proceed to Payment
            </button>
            <button onClick={() => setScreen('feed')} style={{
              width: '100%',
              padding: '12px',
              background: 'transparent',
              border: '1px solid #e0e0e0',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 600,
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {screen === 'notifications' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <button onClick={() => setScreen('feed')} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '16px',
            color: '#1a1a1a',
            fontSize: '16px',
            fontWeight: 600,
          }}>&larr; Back</button>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px 20px' }}>
              <Bell size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} style={{
                background: 'white',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                marginBottom: '12px',
                borderLeft: `4px solid ${notif.type === 'ready' ? '#27ae60' : '#3498db'}`,
              }}>
                <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', color: '#1a1a1a' }}>
                  {notif.message}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* SELLER DASHBOARD */}
      {screen === 'seller-dashboard' && (
        <div style={{ padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
          <button onClick={() => setScreen('feed')} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '16px',
            color: '#1a1a1a',
            fontSize: '16px',
            fontWeight: 600,
          }}>&larr; Back</button>

          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            marginBottom: '16px',
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>
              Your Kitchen
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
              You're selling {myDishes.length} {myDishes.length === 1 ? 'dish' : 'dishes'}
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 600,
            }}>
              What are you cooking today?
            </label>
            <input
              type="text"
              id="dishName"
              placeholder="e.g., Homemade Pasta"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white',
                marginBottom: '8px',
                boxSizing: 'border-box',
              }}
            />
            <button onClick={() => {
              const input = document.getElementById('dishName') as HTMLInputElement;
              if (input.value.trim()) {
                addDish(input.value.trim());
                input.value = '';
              }
            }} style={{
              width: '100%',
              padding: '10px',
              background: '#d4704e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}>
              <Plus size={16} /> Add to Menu
            </button>
          </div>

          {myDishes.length > 0 && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                Your Menu
              </h3>
              {myDishes.map(dish => (
                <div key={dish.id} style={{
                  background: '#f9f9f9',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      {dish.emoji} {dish.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#999' }}>${dish.price}</div>
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
          <button onClick={() => setScreen('feed')} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            marginBottom: '16px',
            color: '#1a1a1a',
            fontSize: '16px',
            fontWeight: 600,
          }}>&larr; Back</button>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#f0e6d2',
              color: '#8b6f47',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              fontWeight: 600,
            }}>{user.avatar}</div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>
              {user.name}
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{user.bio}</p>
          </div>

          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            marginBottom: '16px',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '14px', color: '#666' }}>Seller Mode</span>
              <button onClick={toggleSellerMode} style={{
                width: '48px',
                height: '28px',
                borderRadius: '14px',
                background: user.isSeller ? '#27ae60' : '#e0e0e0',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s',
              }}>
                <div style={{
                  position: 'absolute',
                  width: '24px',
                  height: '24px',
                  background: 'white',
                  borderRadius: '50%',
                  top: '2px',
                  left: user.isSeller ? '22px' : '2px',
                  transition: 'left 0.3s',
                }} />
              </button>
            </div>
            {user.isSeller && (
              <button onClick={() => setScreen('seller-dashboard')} style={{
                width: '100%',
                padding: '10px',
                background: '#d4704e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
                Go to Kitchen
              </button>
            )}
          </div>

          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
          }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              Orders Placed: {orders.length}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              Total Spent: ${orders.reduce((sum, o) => sum + parseFloat(o.total), 0).toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
