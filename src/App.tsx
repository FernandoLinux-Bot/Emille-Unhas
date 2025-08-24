import React, { useState, useMemo, useEffect } from 'react';
import AdminPage from './AdminPage';

// --- Type Definitions ---
type Page = 'HOME' | 'SERVICES' | 'DATETIME' | 'USER_INFO' | 'CONFIRM' | 'PAYMENT' | 'SUCCESS' | 'ADMIN';
type ModalType = 'PORTFOLIO' | 'CONTACT';

interface Service { id: string; name: string; price: number; duration: number; } // duration in minutes
interface UserInfo { name: string; phone: string; }
export interface Booking { startTime: string; duration: number; }

interface BookingState {
  currentPage: Page;
  selectedServices: Map<string, number>;
  selectedDate: string;
  selectedTime: string;
  userInfo: UserInfo;
  inspirationFile: File | null;
}

// --- Constants ---
const SERVICES: Service[] = [
  { id: 'manicure', name: 'Manicure', price: 20, duration: 60 },
  { id: 'pedicure', name: 'Pedicure', price: 20, duration: 60 },
  { id: 'manicure_pedicure', name: 'Manicure + Pedicure', price: 40, duration: 120 },
  { id: 'spa', name: 'Spa dos Pés', price: 35, duration: 60 },
];

// --- Main App Component ---
const App: React.FC = () => {
    
  const [bookingState, setBookingState] = useState<BookingState>({
    currentPage: window.location.pathname === '/admin' ? 'ADMIN' : 'HOME',
    selectedServices: new Map<string, number>(),
    selectedDate: '',
    selectedTime: '',
    userInfo: { name: '', phone: '' },
    inspirationFile: null,
  });
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  
  const { currentPage, selectedServices } = bookingState;

  const updateState = (updates: Partial<BookingState>) => {
    setBookingState(prev => ({ ...prev, ...updates }));
  };

  const handleServiceToggle = (serviceId: string, price: number) => {
      const newSelection = new Map(selectedServices);
      if (newSelection.has(serviceId)) {
          newSelection.delete(serviceId);
      } else {
          newSelection.set(serviceId, price);
          // Handle mutual exclusivity
          if (serviceId === 'manicure_pedicure') {
              newSelection.delete('manicure');
              newSelection.delete('pedicure');
          } else if (serviceId === 'manicure' || serviceId === 'pedicure') {
              newSelection.delete('manicure_pedicure');
          }
      }
      // Reset time selection when services change as duration might change
      updateState({ selectedServices: newSelection, selectedTime: '' });
  };
  
  const totalCost = useMemo(() => {
    let total = 0;
    selectedServices.forEach(price => total += price);
    return total;
  }, [selectedServices]);

  const totalDuration = useMemo(() => {
      let duration = 0;
      selectedServices.forEach((_price, serviceId) => {
          const service = SERVICES.find(s => s.id === serviceId);
          if (service) {
              duration += service.duration;
          }
      });
      return duration;
  }, [selectedServices]);

  const resetBooking = () => {
    setBookingState({
      currentPage: 'HOME',
      selectedServices: new Map(),
      selectedDate: '',
      selectedTime: '',
      userInfo: { name: '', phone: '' },
      inspirationFile: null,
    });
  };

    const handleConfirmBooking = async () => {
        const serviceNames = Array.from(bookingState.selectedServices.keys())
            .map(id => SERVICES.find(s => s.id === id)?.name)
            .filter(Boolean) as string[];

        const bookingDetails = {
            userInfo: bookingState.userInfo,
            selectedDate: bookingState.selectedDate,
            selectedTime: bookingState.selectedTime,
            totalDuration: totalDuration,
            serviceNames: serviceNames,
            totalCost: totalCost,
        };

        const formData = new FormData();
        formData.append('bookingData', JSON.stringify(bookingDetails));
        if (bookingState.inspirationFile) {
            formData.append('inspirationFile', bookingState.inspirationFile);
        }

        try {
            // Usar navigator.sendBeacon se possível para garantir o envio
            // mesmo se a página for descarregada pelo WhatsApp redirect.
            // sendBeacon pode enviar objetos FormData diretamente.
            navigator.sendBeacon('/api/bookings', formData);
        } catch (e) {
            // Fallback para fetch para navegadores mais antigos
            try {
                 await fetch('/api/bookings', {
                    method: 'POST',
                    body: formData,
                    keepalive: true, // Tenta manter a requisição ativa
                });
            } catch (fetchError) {
                console.error("Fetch fallback failed:", fetchError);
                // Opcional: mostrar erro para o usuário
            }
        }
        
        const formattedDate = bookingState.selectedDate ? new Date(`${bookingState.selectedDate}T00:00:00`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        const message = encodeURIComponent(
            `Olá! Gostaria de confirmar meu agendamento na Emille Nails:\n\n` +
            `*Cliente:* ${bookingState.userInfo.name}\n` +
            `*Serviços:* ${serviceNames.join(', ')}\n` +
            `*Data:* ${formattedDate}\n` +
            `*Horário:* ${bookingState.selectedTime}\n\n` +
            `*Total:* R$ ${totalCost.toFixed(2)}`
        );
        const businessWhatsappNumber = "5573981067554";
        const url = `https://wa.me/${businessWhatsappNumber}?text=${message}`;

        window.open(url, '_blank', 'noopener,noreferrer');
        updateState({ currentPage: 'SUCCESS' });
    };

  const pages: Page[] = ['SERVICES', 'DATETIME', 'USER_INFO', 'CONFIRM'];
  const currentPageIndex = pages.indexOf(currentPage);

  const renderPage = () => {
    switch (currentPage) {
      case 'HOME': return <HomePage onNext={() => updateState({ currentPage: 'SERVICES' })} onModalOpen={setActiveModal} />;
      case 'SERVICES': return <ServicesPage bookingState={bookingState} onServiceToggle={handleServiceToggle} onNext={() => updateState({ currentPage: 'DATETIME' })} onBack={() => updateState({ currentPage: 'HOME' })} />;
      case 'DATETIME': return <DateTimePage bookingState={bookingState} updateState={updateState} onNext={() => updateState({ currentPage: 'USER_INFO' })} onBack={() => updateState({ currentPage: 'SERVICES' })} totalDuration={totalDuration} />;
      case 'USER_INFO': return <UserInfoPage bookingState={bookingState} updateState={updateState} onNext={() => updateState({ currentPage: 'CONFIRM' })} onBack={() => updateState({ currentPage: 'DATETIME' })} />;
      case 'CONFIRM': return <ConfirmationPage 
          bookingState={bookingState} 
          totalCost={totalCost} 
          onConfirmAndPayLater={handleConfirmBooking} 
          onBack={() => updateState({ currentPage: 'USER_INFO' })} 
      />;
      case 'SUCCESS': return <SuccessPage onFinish={resetBooking} />;
      case 'ADMIN': return <AdminPage />;
      default: return <HomePage onNext={() => updateState({ currentPage: 'SERVICES' })} onModalOpen={setActiveModal} />;
    }
  };

  const renderModal = () => {
    if (!activeModal) return null;
    switch (activeModal) {
        case 'PORTFOLIO': return <PortfolioModal onClose={() => setActiveModal(null)} />;
        case 'CONTACT': return <ContactModal onClose={() => setActiveModal(null)} />;
        default: return null;
    }
  };

  return (
    <div className="app-container">
        {currentPage !== 'ADMIN' && currentPageIndex >= 0 && <ProgressIndicator currentStep={currentPageIndex} totalSteps={pages.length} />}
        {renderPage()}
        {renderModal()}
    </div>
  );
};

export default App;


// --- Child Components & Props ---

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({currentStep, totalSteps}) => {
    const progressPercentage = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;
    return (
        <div className="progress-indicator">
            <div className="progress-indicator-bar" style={{width: `${progressPercentage}%`}}></div>
            {Array.from({length: totalSteps}).map((_, index) => (
                <div key={index} className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}></div>
            ))}
        </div>
    );
}

interface HomePageProps {
  onNext: () => void;
  onModalOpen: (type: ModalType) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onNext, onModalOpen }) => (
  <div className="page">
    <header className="header" style={{ marginBottom: '1rem' }}>
      <h1>Emille Nails</h1>
      <p>Pedicure & Manicure</p>
    </header>
    <p style={{ textAlign: 'center', marginBottom: '1rem' }}>
      Bem-vinda ao seu espaço de beleza e cuidado.
    </p>
    <button onClick={onNext} className="cta-button">Agendar Agora</button>
    <div className="home-actions">
      <button onClick={() => onModalOpen('PORTFOLIO')} className="nav-button secondary">Nosso Portfólio</button>
      <button onClick={() => onModalOpen('CONTACT')} className="nav-button secondary">Contato e Endereço</button>
    </div>
  </div>
);

interface ServicesPageProps {
  bookingState: BookingState;
  onServiceToggle: (id: string, price: number) => void;
  onNext: () => void;
  onBack: () => void;
}

const ServicesPage: React.FC<ServicesPageProps> = ({ bookingState, onServiceToggle, onNext, onBack }) => (
  <div className="page">
    <header className="header">
      <h2>Nossos Serviços</h2>
      <p>Selecione os serviços desejados.</p>
    </header>
    <div className="service-list">
      {SERVICES.map(service => (
        <div key={service.id}>
          <div
            className={`service-card ${bookingState.selectedServices.has(service.id) ? 'selected' : ''}`}
            onClick={() => onServiceToggle(service.id, service.price)}
            role="checkbox"
            aria-checked={bookingState.selectedServices.has(service.id)}
          >
            <div className="service-card-header">
              <h3>{service.name}</h3>
              <span>R$ {service.price.toFixed(2)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="nav-buttons">
        <button onClick={onBack} className="nav-button secondary">Voltar</button>
        <button onClick={onNext} className="nav-button" disabled={bookingState.selectedServices.size === 0}>Próximo</button>
    </div>
  </div>
);

interface DateTimePageProps {
  bookingState: BookingState;
  updateState: (updates: Partial<BookingState>) => void;
  onNext: () => void;
  onBack: () => void;
  totalDuration: number;
}

const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

const DateTimePage: React.FC<DateTimePageProps> = ({ bookingState, updateState, onNext, onBack, totalDuration }) => {
    const { selectedDate, selectedTime } = bookingState;
    const [dateError, setDateError] = useState('');
    const [bookingsOnDate, setBookingsOnDate] = useState<Booking[]>([]);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);

    useEffect(() => {
        if (!selectedDate) {
            setBookingsOnDate([]);
            return;
        }
        const fetchBookings = async () => {
            setIsLoadingSlots(true);
            try {
                const response = await fetch(`/api/bookings?date=${selectedDate}`);
                const data = await response.json();
                const mappedData = data.map((b: any) => ({ startTime: b.start_time, duration: b.duration_minutes }));
                setBookingsOnDate(mappedData);
            } catch (error) {
                console.error("Failed to fetch bookings", error);
                setDateError("Não foi possível carregar os horários. Tente novamente.");
            } finally {
                setIsLoadingSlots(false);
            }
        };
        fetchBookings();
    }, [selectedDate]);

    const timeSlots = useMemo(() => {
      if (!selectedDate || totalDuration === 0) return [];

      const WORK_DAY_START_MINS = 7 * 60; // 07:00
      const WORK_DAY_END_MINS = 18 * 60; // 18:00
      const SLOT_INTERVAL_MINS = 30; // Check for a new slot every 30 minutes

      const existingBookings = bookingsOnDate.map(b => {
        const start = timeToMinutes(b.startTime);
        return { start, end: start + b.duration };
      });

      const availableSlots: string[] = [];
      for (let slotStart = WORK_DAY_START_MINS; slotStart < WORK_DAY_END_MINS; slotStart += SLOT_INTERVAL_MINS) {
          const slotEnd = slotStart + totalDuration;

          if (slotEnd > WORK_DAY_END_MINS) break;
          
          const isOverlapping = existingBookings.some(booking => 
              (slotStart < booking.end && slotEnd > booking.start)
          );

          if (!isOverlapping) {
              availableSlots.push(minutesToTime(slotStart));
          }
      }
      return availableSlots;
    }, [selectedDate, totalDuration, bookingsOnDate]);

    useEffect(() => {
        if (selectedTime && !timeSlots.includes(selectedTime)) {
            updateState({ selectedTime: '' });
        }
    }, [timeSlots, selectedTime, updateState]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = new Date(e.target.value + "T00:00:00");
        if (date.getUTCDay() === 0) { // Sunday
            setDateError("Desculpe, não atendemos aos domingos.");
        } else {
            setDateError('');
        }
        updateState({ selectedDate: e.target.value, selectedTime: '' });
    }
    
    return (
        <div className="page date-time-container">
            <header className="header">
                <h2>Data e Hora</h2>
                <p>Escolha o melhor dia e horário para você.</p>
                {totalDuration > 0 && <p>Duração total: <strong>{Math.floor(totalDuration/60)}h {totalDuration % 60}min</strong></p>}
            </header>
            <div className="form-group">
                <label htmlFor="date-picker">Data</label>
                <input 
                    type="date" 
                    id="date-picker"
                    value={selectedDate}
                    onChange={handleDateChange}
                    min={new Date().toISOString().split("T")[0]}
                />
                {dateError && <p className="form-error">{dateError}</p>}
            </div>
            <div className="form-group">
                <label>Horário</label>
                <div className="time-slots">
                    {isLoadingSlots ? <p className="no-slots-message">Carregando horários...</p> : 
                     timeSlots.length > 0 ? timeSlots.map(time => (
                        <div 
                            key={time}
                            className={`time-slot ${selectedTime === time ? 'selected' : ''}`}
                            onClick={() => updateState({ selectedTime: time })}
                            role="button"
                            aria-pressed={selectedTime === time}
                        >
                            {time}
                        </div>
                    )) : (
                      <p className="no-slots-message">
                          {selectedDate ? "Nenhum horário disponível para esta data com os serviços selecionados." : "Por favor, selecione uma data."}
                      </p>
                    )}
                </div>
            </div>
            <div className="nav-buttons">
                <button onClick={onBack} className="nav-button secondary">Voltar</button>
                <button onClick={onNext} className="nav-button" disabled={!selectedDate || !selectedTime || !!dateError}>Próximo</button>
            </div>
        </div>
    );
};

interface UserInfoPageProps {
  bookingState: BookingState;
  updateState: (updates: Partial<BookingState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const UserInfoPage: React.FC<UserInfoPageProps> = ({ bookingState, updateState, onNext, onBack }) => {
    const { userInfo, inspirationFile } = bookingState;
    const isFormValid = userInfo.name.trim() !== '' && userInfo.phone.trim().length > 8;
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            updateState({ inspirationFile: e.target.files[0] });
        }
    };

    return (
        <div className="page user-info-container">
            <header className="header">
                <h2>Seus Dados</h2>
                <p>Precisamos de algumas informações para confirmar.</p>
            </header>
            <div className="form-group">
                <label htmlFor="name">Nome Completo</label>
                <input
                    type="text"
                    id="name"
                    value={userInfo.name}
                    onChange={(e) => updateState({ userInfo: { ...userInfo, name: e.target.value } })}
                    placeholder="Seu nome"
                />
            </div>
            <div className="form-group">
                <label htmlFor="phone">Telefone (WhatsApp)</label>
                <input
                    type="tel"
                    id="phone"
                    value={userInfo.phone}
                    onChange={(e) => updateState({ userInfo: { ...userInfo, phone: e.target.value } })}
                    placeholder="(XX) XXXXX-XXXX"
                />
            </div>
            <div className="form-group">
                <label htmlFor="inspiration">Foto de Inspiração (Opcional)</label>
                 <input type="file" id="inspiration" accept="image/*" onChange={handleFileChange} />
                 {inspirationFile && <p className="file-selected-message">Arquivo selecionado: {inspirationFile.name}</p>}
            </div>
            <div className="nav-buttons">
                <button onClick={onBack} className="nav-button secondary">Voltar</button>
                <button onClick={onNext} className="nav-button" disabled={!isFormValid}>Próximo</button>
            </div>
        </div>
    );
};

interface ConfirmationPageProps {
  bookingState: BookingState;
  totalCost: number;
  onConfirmAndPayLater: () => void;
  onBack: () => void;
}

const ConfirmationPage: React.FC<ConfirmationPageProps> = ({ bookingState, totalCost, onConfirmAndPayLater, onBack }) => {
    const { selectedServices, selectedDate, selectedTime, userInfo, inspirationFile } = bookingState;

    const serviceNames = Array.from(selectedServices.keys())
        .map(id => SERVICES.find(s => s.id === id)?.name)
        .filter(Boolean);

    const formattedDate = selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';

    return (
        <div className="page confirmation-container">
            <header className="header">
                <h2>Confirmação</h2>
                <p>Revise os detalhes do seu agendamento.</p>
            </header>
            <div className="confirmation-summary">
                <h4>Resumo</h4>
                <p><strong>Cliente:</strong> {userInfo.name}</p>
                <p><strong>Telefone:</strong> {userInfo.phone}</p>
                <p><strong>Serviços:</strong> {serviceNames.join(', ')}</p>
                <p><strong>Data:</strong> {formattedDate}</p>
                <p><strong>Horário:</strong> {selectedTime}</p>
                {inspirationFile && <p><strong>Inspiração:</strong> {inspirationFile.name}</p>}
                <p><strong>Total:</strong> R$ {totalCost.toFixed(2)}</p>
            </div>
            
            <div className="nav-buttons-column">
                <button onClick={onConfirmAndPayLater} className="nav-button">Confirmar e Enviar no WhatsApp</button>
                <button onClick={onBack} className="nav-button secondary">Voltar</button>
            </div>
        </div>
    )
};

const SuccessPage: React.FC<{ onFinish: () => void }> = ({ onFinish }) => (
    <div className="page">
        <div className="success-message">
            <div className="success-icon">💅</div>
            <h2>Agendamento Realizado!</h2>
            <p>Seu horário foi salvo. Por favor, envie a mensagem que abrimos no seu WhatsApp para finalizar a confirmação. Mal podemos esperar para te ver!</p>
        </div>
        <button onClick={onFinish} className="nav-button">Agendar Outro Horário</button>
    </div>
);

const Modal: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => (
    <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button onClick={onClose} className="modal-close-button">&times;</button>
            {children}
        </div>
    </div>
);

const PortfolioModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [images, setImages] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const response = await fetch('/api/portfolio');
                const data = await response.json();
                setImages(data);
            } catch (error) {
                console.error("Failed to fetch portfolio", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchImages();
    }, []);

    return (
        <Modal onClose={onClose}>
            <header className="header" style={{marginBottom: "1rem"}}><h2>Nosso Trabalho</h2></header>
            <div className="portfolio-gallery">
                 {isLoading ? <p>Carregando...</p> : 
                   images.length > 0 ?
                   images.map(url => <img key={url} src={url} alt="Exemplo de unha" />) :
                   <p>Nenhuma foto no portfólio ainda.</p>
                 }
            </div>
        </Modal>
    );
};

const ContactModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
    <Modal onClose={onClose}>
        <header className="header" style={{marginBottom: "1rem"}}><h2>Contato e Endereço</h2></header>
        <div className="contact-info">
            <p><strong>Endereço:</strong> RUA SIQUEIRA CAMPOS - 223 - CENTRO</p>
            <p><strong>WhatsApp:</strong> (73) 98106-7554</p>
            <p><strong>Horário de Funcionamento:</strong><br/>
            Segunda a Sábado: 09:00 - 18:00<br/>
            Domingo: Fechado</p>
        </div>
    </Modal>
);