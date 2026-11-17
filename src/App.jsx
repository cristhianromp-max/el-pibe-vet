import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Camera, Image as ImageIcon, Check, Clock, AlertTriangle,
  Activity, Stethoscope, FileText, RefreshCw, User,
  Phone, MapPin, Trash2, ExternalLink, Upload, X, CheckCircle2,
  Database, Cloud, LayoutGrid, ClipboardList, HeartPulse, ShieldCheck,
  Send, SwitchCamera, Save, LogOut, History, ChevronDown, ChevronUp, UserCheck
} from 'lucide-react';

// ============================================================================
// CONFIGURACIÓN DE CONEXIÓN EN LA NUBE (SUPABASE + GOOGLE DRIVE APPS SCRIPT)
// ============================================================================
const SUPABASE_URL = 'https://hlxlmxroatclyxijjriv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4efpCCCncv7wkoR8m_5NgA_ITwHWgo5';
const DRIVE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxonB3FMTydGH5zVaSLyNhgce9-IrDbWlRrwG5adL3I4njxBEHaY_5AKylwhYTCNLDy/exec';

const HOURS = ['9am', '11am', '3pm', '9pm', '11pm'];
const TURNOS = [
  { key: 'M', label: 'Mañana (M)' },
  { key: 'T', label: 'Tarde (T)' },
  { key: 'N', label: 'Noche (N)' }
];

// Normaliza celdas horarias (soporta formato antiguo string y nuevo objeto { status, medico, hora })
function parseHourEntry(entry) {
  if (!entry) return { status: '', medico: '', hora: '' };
  if (typeof entry === 'string') return { status: entry, medico: '', hora: '' };
  return {
    status: entry.status || '',
    medico: entry.medico || '',
    hora: entry.hora || ''
  };
}

// Cliente REST nativo para Supabase
async function sbFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: options.prefer || 'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Compresor seguro de imágenes
function compressImageFile(file, maxWidth = 640, quality = 0.76) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      const img = new window.Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          const scale = img.width > maxWidth ? maxWidth / img.width : 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function calculateStayDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return '1 día';
  const start = new Date(`${startDateStr}T00:00:00`);
  const end = new Date(`${endDateStr}T00:00:00`);
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  const days = Math.max(1, diff + 1);
  return days === 1 ? '1 día' : `${days} días`;
}

const TODAY_STR = new Date().toISOString().split('T')[0];

const DEMO_SEED = {
  propietarios: [
    { id: '11111111-1111-1111-1111-111111111111', nombre: 'Andrés Borja', cedula: '0924587123', telefono: '593991234567', direccion: 'Av. Principal y Calle 4ta' },
    { id: '22222222-2222-2222-2222-222222222222', nombre: 'Valeria Mendoza', cedula: '0918745632', telefono: '593987654321', direccion: 'Cdla. Los Ceibos' }
  ],
  pacientes: [
    {
      id: 'aaaa1111-1111-1111-1111-111111111111',
      propietario_id: '11111111-1111-1111-1111-111111111111',
      nombre: 'CHAVO',
      especie: 'CANINO',
      raza: 'Mestizo',
      sexo: 'M',
      edad: '1 año 4 meses',
      peso_kg: 11.4,
      comportamiento: 'D',
      alergias: 'Ninguna conocida',
      foto_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80'
    },
    {
      id: 'bbbb2222-2222-2222-2222-222222222222',
      propietario_id: '22222222-2222-2222-2222-222222222222',
      nombre: 'MAX',
      especie: 'FELINO',
      raza: 'Doméstico Pelo Corto',
      sexo: 'M',
      edad: '3 años',
      peso_kg: 4.6,
      comportamiento: 'I',
      alergias: 'Sensibilidad a Penicilinas',
      foto_url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80'
    }
  ],
  hospitalizaciones: [
    {
      id: 'hhhh1111-1111-1111-1111-111111111111',
      paciente_id: 'aaaa1111-1111-1111-1111-111111111111',
      fecha_ingreso: TODAY_STR,
      fecha_retiro: null,
      dias_recomendados: '3 - 5 días',
      ubicacion: 'INFECTOLOGIA',
      condicion: 'EST',
      medico_responsable: 'MVZ. Cristhian Romero',
      diagnostico: 'Gastroenteritis hemorrágica aguda / Descartar Parvovirosis',
      observaciones: 'Mantener vía permeable en miembro anterior derecho. Control estricto de vómitos y temperatura.',
      foto_jaula_url: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80',
      activa: true
    },
    {
      id: 'hhhh2222-2222-2222-2222-222222222222',
      paciente_id: 'bbbb2222-2222-2222-2222-222222222222',
      fecha_ingreso: TODAY_STR,
      fecha_retiro: null,
      dias_recomendados: '2 días',
      ubicacion: 'HOSPITAL GENERAL',
      condicion: 'OBS',
      medico_responsable: 'MVZ. Cristhian Romero',
      diagnostico: 'FLUTD / Obstrucción uretral post-sondaje',
      observaciones: 'Monitorear producción urinaria y permeabilidad de sonda.',
      foto_jaula_url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=600&q=80',
      activa: true
    }
  ],
  medicaciones: [
    {
      id: 'mmmm1111-1111-1111-1111-111111111111',
      hospitalizacion_id: 'hhhh1111-1111-1111-1111-111111111111',
      medicina: 'ENZIMAX',
      dosis: '2 ml',
      via: 'VO',
      frecuencia: 'C12',
      duracion: '5 días',
      horarios_json: {
        '9am': { status: 'done', medico: 'MVZ. Cristhian Romero', hora: '09:05' },
        '9pm': { status: 'pending', medico: '', hora: '' }
      }
    },
    {
      id: 'mmmm2222-2222-2222-2222-222222222222',
      hospitalizacion_id: 'hhhh1111-1111-1111-1111-111111111111',
      medicina: 'UVITA GEL',
      dosis: '3 cm',
      via: 'VO',
      frecuencia: 'C12',
      duracion: '5 días',
      horarios_json: {
        '9am': { status: 'done', medico: 'MVZ. Cristhian Romero', hora: '09:08' },
        '9pm': { status: 'pending', medico: '', hora: '' }
      }
    },
    {
      id: 'mmmm3333-3333-3333-3333-333333333333',
      hospitalizacion_id: 'hhhh1111-1111-1111-1111-111111111111',
      medicina: 'HEPATOMIC',
      dosis: '1.5 ml',
      via: 'IV',
      frecuencia: 'C24',
      duracion: '4 días',
      horarios_json: {
        '11am': { status: 'done', medico: 'MVZ. Cristhian Romero', hora: '11:02' }
      }
    },
    {
      id: 'mmmm4444-4444-4444-4444-444444444444',
      hospitalizacion_id: 'hhhh1111-1111-1111-1111-111111111111',
      medicina: 'PROTEIZOO',
      dosis: '5 ml',
      via: 'IV lento',
      frecuencia: 'C12',
      duracion: '3 días',
      horarios_json: {
        '11am': { status: 'done', medico: 'MVZ. Cristhian Romero', hora: '11:05' },
        '11pm': { status: 'pending', medico: '', hora: '' }
      }
    }
  ],
  monitoreos: [
    { id: 'nnnn1111-1111-1111-1111-111111111111', hospitalizacion_id: 'hhhh1111-1111-1111-1111-111111111111', fecha: TODAY_STR, turno: 'M', responsable: 'Cris', comida: 'Ayuno', conciencia: 'ACT', temperatura: '38.6', vomitos: 'N', diarreas: 'S', orina: 'S', heces: 'S', deshidratacion: '5%', fluidoterapia_ml_h: '35' },
    { id: 'nnnn2222-2222-2222-2222-222222222222', hospitalizacion_id: 'hhhh1111-1111-1111-1111-111111111111', fecha: TODAY_STR, turno: 'T', responsable: 'Cris', comida: 'Blanda 30g', conciencia: 'ACT', temperatura: '38.4', vomitos: 'N', diarreas: 'N', orina: 'S', heces: 'N', deshidratacion: '0%', fluidoterapia_ml_h: '25' }
  ],
  consultas: [
    {
      id: 'cccc1111-1111-1111-1111-111111111111',
      paciente_id: 'aaaa1111-1111-1111-1111-111111111111',
      fecha: TODAY_STR,
      medico: 'MVZ. Cristhian Romero',
      motivo: 'Decaimiento y diarrea pastosa con estrías de sangre',
      anamnesis: 'Inició ayer por la noche con anorexia y dos episodios de diarrea.',
      temperatura: '38.9 °C',
      fc: '128 lpm',
      fr: '28 rpm',
      trc: '2 seg',
      mucosas: 'Rosadas pálidas',
      deshidratacion: '6%',
      examen_fisico: 'Dolor leve a la palpación abdominal mesogástrica. Linfonodos submandibulares normales.',
      diferenciales: 'Parvovirosis canina, Gastroenteritis parasitaria (Giardia/Ancylostoma), Indiscreción alimentaria.',
      diagnostico: 'Gastroenteritis hemorrágica aguda',
      tratamiento: 'Hospitalización, fluidoterapia Ringer Lactato, protector hepático y soporte nutricional.',
      observaciones: 'Se solicita hemograma y test rápido.'
    }
  ],
  preventivos: [
    {
      id: 'pppp1111-1111-1111-1111-111111111111',
      paciente_id: 'aaaa1111-1111-1111-1111-111111111111',
      tipo: 'Vacuna',
      producto: 'Séxtuple Canina (DHPPI + L)',
      dosis: '1 ml SC',
      fecha_aplicacion: '2026-02-15',
      proxima_fecha: '2027-02-15',
      observaciones: 'Refuerzo anual sin reacciones'
    },
    {
      id: 'pppp2222-2222-2222-2222-222222222222',
      paciente_id: 'aaaa1111-1111-1111-1111-111111111111',
      tipo: 'Desp. Interna',
      producto: 'Febantel + Pirantel + Praziquantel',
      dosis: '1 tab / 10 kg',
      fecha_aplicacion: '2026-09-01',
      proxima_fecha: '2026-12-01',
      observaciones: 'Control trimestral'
    }
  ],
  adjuntos: []
};

// ============================================================================
// COMPONENTE: BOTONES DE GALERÍA + CÁMARA
// ============================================================================
function PhotoActionButtons({ onImageSelected, onOpenCamera, compact = false }) {
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      onImageSelected(compressed);
    } catch (err) {
      console.error('Error procesando imagen:', err);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div
        className={`relative overflow-hidden inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition cursor-pointer ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'
        }`}
      >
        <ImageIcon className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Galería' : 'Galería / Archivo'}</span>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          title="Seleccionar imagen desde galería o PC"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <button
        type="button"
        onClick={onOpenCamera}
        className={`inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'
        }`}
      >
        <Camera className="w-3.5 h-3.5 shrink-0" />
        <span>Cámara</span>
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENTE: MODAL DE CÁMARA EN VIVO + RESPALDO NATIVO MÓVIL
// ============================================================================
function CameraCaptureModal({ isOpen, onClose, onCapture, title = 'Capturar Fotografía' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setCameraError('');

    async function startStream() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Navegador sin acceso directo a video');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 } },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (active) {
          setCameraError('Usa el botón inferior para abrir la cámara nativa de tu teléfono.');
        }
      }
    }

    startStream();
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const maxWidth = 640;
    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    onCapture(dataUrl);
    onClose();
  };

  const handleNativeFallback = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file);
    onCapture(compressed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-400" />
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!cameraError ? (
            <div className="relative bg-black rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
                className="absolute top-3 right-3 bg-slate-900/70 text-white p-2 rounded-full hover:bg-slate-900"
                title="Cambiar cámara frontal/trasera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-xs text-amber-800">
              {cameraError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {!cameraError && (
              <button
                type="button"
                onClick={takeSnapshot}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <Camera className="w-4 h-4" />
                Capturar Foto Ahora
              </button>
            )}

            <div className="relative overflow-hidden w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl flex items-center justify-center gap-2 border border-slate-300 cursor-pointer text-xs">
              <Upload className="w-4 h-4 text-teal-700" />
              <span>Cámara del Teléfono / Seleccionar Archivo</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleNativeFallback}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// APLICACIÓN PRINCIPAL: CLÍNICA VETERINARIA EL PIBE
// ============================================================================
export default function App() {
  const [propietarios, setPropietarios] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [hospitalizaciones, setHospitalizaciones] = useState([]);
  const [medicaciones, setMedicaciones] = useState([]);
  const [monitoreos, setMonitoreos] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [preventivos, setPreventivos] = useState([]);
  const [adjuntos, setAdjuntos] = useState([]);

  const [selectedPacienteId, setSelectedPacienteId] = useState('');
  const [activeTab, setActiveTab] = useState('hospitalizacion');
  const [viewMode, setViewMode] = useState('ficha');
  const [cageFilter, setCageFilter] = useState('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(TODAY_STR);

  // Médico activo de guardia que registra la administración de medicamentos
  const [activeDoctor, setActiveDoctor] = useState(() => {
    return localStorage.getItem('el_pibe_active_doctor') || 'MVZ. Cristhian Romero';
  });

  useEffect(() => {
    localStorage.setItem('el_pibe_active_doctor', activeDoctor);
  }, [activeDoctor]);

  const [dbStatus, setDbStatus] = useState('checking');
  const [isEmptyCloud, setIsEmptyCloud] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState(null);

  const [cameraTarget, setCameraTarget] = useState(null);
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    propNombre: '', propCedula: '', propTelefono: '', propDireccion: '',
    pacNombre: '', pacEspecie: 'CANINO', pacRaza: '', pacSexo: 'M',
    pacEdad: '', pacPeso: '', pacComportamiento: 'D', pacAlergias: 'Ninguna conocida',
    fotoUrl: '', hospitalizarAhora: true, ubicacion: 'HOSPITAL GENERAL', diagnostico: ''
  });

  // Estados de Alta Médica e Historial de Hospitalizaciones
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({
    fecha_retiro: TODAY_STR,
    dias_totales: '1 día',
    notas_alta: ''
  });
  const [expandedHistoryId, setExpandedHistoryId] = useState(null);

  const [newMed, setNewMed] = useState({ medicina: '', dosis: '', via: 'IV', frecuencia: 'C12', duracion: '3 días' });
  const [newConsulta, setNewConsulta] = useState({
    medico: 'MVZ. Cristhian Romero', motivo: '', anamnesis: '',
    temperatura: '', fc: '', fr: '', trc: '2 seg', mucosas: 'Rosadas',
    deshidratacion: '0%', examen_fisico: '', diferenciales: '',
    diagnostico: '', tratamiento: '', observaciones: ''
  });
  const [newPrev, setNewPrev] = useState({
    tipo: 'Vacuna', producto: '', dosis: '', fecha_aplicacion: TODAY_STR, proxima_fecha: '', observaciones: ''
  });
  const [examForm, setExamForm] = useState({ categoria: 'Hemograma', notas: '' });
  const [uploadingDrive, setUploadingDrive] = useState(false);

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar datos desde Supabase
  const loadAllData = async () => {
    setDbStatus('checking');
    try {
      const [props, pacs, hosps, meds, mons, cons, prevs, adjs] = await Promise.all([
        sbFetch('propietarios?select=*&order=created_at.desc'),
        sbFetch('pacientes?select=*&order=created_at.desc'),
        sbFetch('hospitalizaciones?select=*&order=created_at.desc'),
        sbFetch('hosp_medicacion?select=*&order=created_at.asc'),
        sbFetch('hosp_monitoreo?select=*'),
        sbFetch('consultas?select=*&order=fecha.desc,created_at.desc'),
        sbFetch('preventivos?select=*&order=fecha_aplicacion.desc'),
        sbFetch('adjuntos?select=*&order=fecha.desc,created_at.desc')
      ]);

      setDbStatus('connected');

      if (!pacs || pacs.length === 0) {
        setIsEmptyCloud(true);
        setPropietarios(DEMO_SEED.propietarios);
        setPacientes(DEMO_SEED.pacientes);
        setHospitalizaciones(DEMO_SEED.hospitalizaciones);
        setMedicaciones(DEMO_SEED.medicaciones);
        setMonitoreos(DEMO_SEED.monitoreos);
        setConsultas(DEMO_SEED.consultas);
        setPreventivos(DEMO_SEED.preventivos);
        setAdjuntos(DEMO_SEED.adjuntos);
        setSelectedPacienteId(DEMO_SEED.pacientes[0].id);
      } else {
        setIsEmptyCloud(false);
        setPropietarios(props || []);
        setPacientes(pacs || []);
        setHospitalizaciones(hosps || []);
        setMedicaciones(meds || []);
        setMonitoreos(mons || []);
        setConsultas(cons || []);
        setPreventivos(prevs || []);
        setAdjuntos(adjs || []);
        setSelectedPacienteId((prev) => (pacs.some((p) => p.id === prev) ? prev : pacs[0].id));
      }
    } catch (err) {
      console.warn('Usando almacenamiento local:', err.message);
      setDbStatus('local');
      const cached = localStorage.getItem('el_pibe_vet_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        setPropietarios(parsed.propietarios || DEMO_SEED.propietarios);
        setPacientes(parsed.pacientes || DEMO_SEED.pacientes);
        setHospitalizaciones(parsed.hospitalizaciones || DEMO_SEED.hospitalizaciones);
        setMedicaciones(parsed.medicaciones || DEMO_SEED.medicaciones);
        setMonitoreos(parsed.monitoreos || DEMO_SEED.monitoreos);
        setConsultas(parsed.consultas || DEMO_SEED.consultas);
        setPreventivos(parsed.preventivos || DEMO_SEED.preventivos);
        setAdjuntos(parsed.adjuntos || DEMO_SEED.adjuntos);
        setSelectedPacienteId((parsed.pacientes?.[0] || DEMO_SEED.pacientes[0]).id);
      } else {
        setPropietarios(DEMO_SEED.propietarios);
        setPacientes(DEMO_SEED.pacientes);
        setHospitalizaciones(DEMO_SEED.hospitalizaciones);
        setMedicaciones(DEMO_SEED.medicaciones);
        setMonitoreos(DEMO_SEED.monitoreos);
        setConsultas(DEMO_SEED.consultas);
        setPreventivos(DEMO_SEED.preventivos);
        setAdjuntos(DEMO_SEED.adjuntos);
        setSelectedPacienteId(DEMO_SEED.pacientes[0].id);
      }
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (pacientes.length > 0) {
      localStorage.setItem(
        'el_pibe_vet_cache',
        JSON.stringify({
          propietarios, pacientes, hospitalizaciones, medicaciones,
          monitoreos, consultas, preventivos, adjuntos
        })
      );
    }
  }, [propietarios, pacientes, hospitalizaciones, medicaciones, monitoreos, consultas, preventivos, adjuntos]);

  const handleSeedCloudDemo = async () => {
    setSeeding(true);
    try {
      const upsertPrefer = 'resolution=merge-duplicates,return=representation';
      await sbFetch('propietarios?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.propietarios) });
      await sbFetch('pacientes?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.pacientes) });
      await sbFetch('hospitalizaciones?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.hospitalizaciones) });
      await sbFetch('hosp_medicacion?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.medicaciones) });
      await sbFetch('hosp_monitoreo?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.monitoreos) });
      await sbFetch('consultas?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.consultas) });
      await sbFetch('preventivos?on_conflict=id', { method: 'POST', prefer: upsertPrefer, body: JSON.stringify(DEMO_SEED.preventivos) });
      setIsEmptyCloud(false);
      notify('¡Chavo y Max sincronizados en tu nube Supabase!');
      await loadAllData();
    } catch (err) {
      notify(`Error al sincronizar: ${err.message}`, 'error');
    } finally {
      setSeeding(false);
    }
  };

  const currentPaciente = pacientes.find((p) => p.id === selectedPacienteId) || pacientes[0];
  const currentPropietario = propietarios.find((pr) => pr.id === currentPaciente?.propietario_id);
  const currentHosp = hospitalizaciones.find((h) => h.paciente_id === currentPaciente?.id && h.activa);
  const pastHosps = hospitalizaciones.filter((h) => h.paciente_id === currentPaciente?.id && !h.activa);
  const currentMeds = medicaciones.filter((m) => m.hospitalizacion_id === currentHosp?.id);
  const currentConsultas = consultas.filter((c) => c.paciente_id === currentPaciente?.id);
  const currentPreventivos = preventivos.filter((p) => p.paciente_id === currentPaciente?.id);
  const currentAdjuntos = adjuntos.filter((a) => a.paciente_id === currentPaciente?.id);

  // Abrir modal de Alta Médica con cálculo automático de días
  const openDischargeModal = () => {
    if (!currentHosp) return;
    const calcDays = calculateStayDays(currentHosp.fecha_ingreso || TODAY_STR, TODAY_STR);
    setDischargeForm({
      fecha_retiro: TODAY_STR,
      dias_totales: calcDays,
      notas_alta: ''
    });
    setShowDischargeModal(true);
  };

  // Confirmar Alta Médica y archivar hospitalización completa
  const handleConfirmDischarge = async (e) => {
    e.preventDefault();
    if (!currentHosp) return;

    const doctorName = activeDoctor.trim() || 'MVZ. Cristhian Romero';
    const prevObs = currentHosp.observaciones ? `${currentHosp.observaciones}\n` : '';
    const altaNote = dischargeForm.notas_alta.trim()
      ? `[ALTA ${dischargeForm.fecha_retiro} • ${dischargeForm.dias_totales} • Por: ${doctorName}]: ${dischargeForm.notas_alta.trim()}`
      : `[ALTA ${dischargeForm.fecha_retiro} • ${dischargeForm.dias_totales} • Por: ${doctorName}]`;
    const finalObservaciones = `${prevObs}${altaNote}`.trim();

    const patchData = {
      activa: false,
      fecha_retiro: dischargeForm.fecha_retiro,
      dias_recomendados: dischargeForm.dias_totales,
      observaciones: finalObservaciones
    };

    setHospitalizaciones((prev) =>
      prev.map((h) => (h.id === currentHosp.id ? { ...h, ...patchData } : h))
    );
    setExpandedHistoryId(currentHosp.id);
    setShowDischargeModal(false);
    notify(`Alta registrada para ${currentPaciente?.nombre} (${dischargeForm.dias_totales})`);

    if (dbStatus === 'connected') {
      try {
        await sbFetch(`hospitalizaciones?id=eq.${currentHosp.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patchData)
        });
      } catch (err) {
        notify(`Error guardando alta en nube: ${err.message}`, 'error');
      }
    }
  };

  const handleUpdatePhoto = async (target, dataUrl) => {
    if (!target) return;
    if (target.type === 'nuevo') {
      setNewPatientForm((prev) => ({ ...prev, fotoUrl: dataUrl }));
      notify('Foto cargada para el nuevo paciente');
      return;
    }

    if (target.type === 'paciente' && currentPaciente) {
      setPacientes((prev) =>
        prev.map((p) => (p.id === currentPaciente.id ? { ...p, foto_url: dataUrl } : p))
      );
      notify('Foto de perfil actualizada');
      if (dbStatus === 'connected') {
        try {
          await sbFetch(`pacientes?id=eq.${currentPaciente.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ foto_url: dataUrl })
          });
        } catch (err) {
          console.error(err);
        }
      }
    }

    if (target.type === 'jaula' && currentHosp) {
      setHospitalizaciones((prev) =>
        prev.map((h) => (h.id === currentHosp.id ? { ...h, foto_jaula_url: dataUrl } : h))
      );
      notify('Foto en jaula actualizada');
      if (dbStatus === 'connected') {
        try {
          await sbFetch(`hospitalizaciones?id=eq.${currentHosp.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ foto_jaula_url: dataUrl })
          });
        } catch (err) {
          console.error(err);
        }
      }
    }

    if (target.type === 'jaula_id' && target.id) {
      setHospitalizaciones((prev) =>
        prev.map((h) => (h.id === target.id ? { ...h, foto_jaula_url: dataUrl } : h))
      );
      notify('Foto de jaula actualizada');
      if (dbStatus === 'connected') {
        try {
          await sbFetch(`hospitalizaciones?id=eq.${target.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ foto_jaula_url: dataUrl })
          });
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  // Ciclo de 4 estados por toma:
  // '' (sin programar) -> 'pending' (programado amarillo) -> 'done' (aplicado verde + médico + hora) -> 'missed' (faltó rojo + médico) -> ''
  const toggleMedHour = async (med, hour) => {
    const parsed = parseHourEntry(med.horarios_json?.[hour]);
    const doctorName = activeDoctor.trim() || 'Médico de turno';
    const nowTime = new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false });

    const updatedJson = { ...(med.horarios_json || {}) };

    if (parsed.status === '') {
      updatedJson[hour] = { status: 'pending', medico: '', hora: '' };
    } else if (parsed.status === 'pending') {
      updatedJson[hour] = { status: 'done', medico: doctorName, hora: nowTime };
      notify(`${med.medicina} (${hour}) aplicado por ${doctorName}`);
    } else if (parsed.status === 'done') {
      updatedJson[hour] = { status: 'missed', medico: doctorName, hora: nowTime };
      notify(`${med.medicina} (${hour}) marcado como FALTÓ`, 'error');
    } else {
      delete updatedJson[hour];
    }

    setMedicaciones((prev) =>
      prev.map((m) => (m.id === med.id ? { ...m, horarios_json: updatedJson } : m))
    );

    if (dbStatus === 'connected') {
      try {
        await sbFetch(`hosp_medicacion?id=eq.${med.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ horarios_json: updatedJson })
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!currentHosp || !newMed.medicina.trim()) return;

    const payload = {
      hospitalizacion_id: currentHosp.id,
      medicina: newMed.medicina.toUpperCase(),
      dosis: newMed.dosis,
      via: newMed.via,
      frecuencia: newMed.frecuencia,
      duracion: newMed.duracion,
      horarios_json: {}
    };

    const tempId = crypto.randomUUID();
    setMedicaciones((prev) => [...prev, { id: tempId, ...payload }]);
    setNewMed({ medicina: '', dosis: '', via: 'IV', frecuencia: 'C12', duracion: '3 días' });
    notify('Medicación añadida a la grilla');

    if (dbStatus === 'connected') {
      try {
        const res = await sbFetch('hosp_medicacion', { method: 'POST', body: JSON.stringify(payload) });
        if (res?.[0]) {
          setMedicaciones((prev) => prev.map((m) => (m.id === tempId ? res[0] : m)));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteMedication = async (medId) => {
    setMedicaciones((prev) => prev.filter((m) => m.id !== medId));
    if (dbStatus === 'connected') {
      try {
        await sbFetch(`hosp_medicacion?id=eq.${medId}`, { method: 'DELETE' });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const updateHospField = async (field, value) => {
    if (!currentHosp) return;
    setHospitalizaciones((prev) =>
      prev.map((h) => (h.id === currentHosp.id ? { ...h, [field]: value } : h))
    );
    if (dbStatus === 'connected') {
      try {
        await sbFetch(`hospitalizaciones?id=eq.${currentHosp.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ [field]: value })
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const updateMonitoreoCell = async (turnoKey, field, value) => {
    if (!currentHosp) return;
    const existing = monitoreos.find(
      (m) => m.hospitalizacion_id === currentHosp.id && m.fecha === selectedDate && m.turno === turnoKey
    );

    const updatedRecord = {
      hospitalizacion_id: currentHosp.id,
      fecha: selectedDate,
      turno: turnoKey,
      responsable: existing?.responsable || activeDoctor.trim() || 'Cris',
      comida: existing?.comida || '',
      conciencia: existing?.conciencia || 'ACT',
      temperatura: existing?.temperatura || '',
      vomitos: existing?.vomitos || 'N',
      diarreas: existing?.diarreas || 'N',
      orina: existing?.orina || 'S',
      heces: existing?.heces || 'N',
      deshidratacion: existing?.deshidratacion || '0%',
      fluidoterapia_ml_h: existing?.fluidoterapia_ml_h || '',
      [field]: value
    };

    setMonitoreos((prev) => {
      if (existing) {
        return prev.map((m) => (m.id === existing.id ? { ...m, ...updatedRecord } : m));
      }
      return [...prev, { id: crypto.randomUUID(), ...updatedRecord }];
    });

    if (dbStatus === 'connected') {
      try {
        await sbFetch('hosp_monitoreo?on_conflict=hospitalizacion_id,fecha,turno', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=representation',
          body: JSON.stringify(updatedRecord)
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAdmitPatient = async () => {
    if (!currentPaciente) return;
    const payload = {
      paciente_id: currentPaciente.id,
      fecha_ingreso: TODAY_STR,
      fecha_retiro: null,
      dias_recomendados: '3 días',
      ubicacion: 'HOSPITAL GENERAL',
      condicion: 'EST',
      medico_responsable: activeDoctor.trim() || 'MVZ. Cristhian Romero',
      diagnostico: 'En observación clínica',
      observaciones: '',
      foto_jaula_url: currentPaciente.foto_url || '',
      activa: true
    };
    const tempId = crypto.randomUUID();
    setHospitalizaciones((prev) => [{ id: tempId, ...payload }, ...prev]);
    notify('Paciente ingresado a hospitalización');

    if (dbStatus === 'connected') {
      try {
        const res = await sbFetch('hospitalizaciones', { method: 'POST', body: JSON.stringify(payload) });
        if (res?.[0]) {
          setHospitalizaciones((prev) => prev.map((h) => (h.id === tempId ? res[0] : h)));
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreatePatient = async (e) => {
    e.preventDefault();
    if (!newPatientForm.pacNombre.trim() || !newPatientForm.propNombre.trim()) return;

    const propPayload = {
      nombre: newPatientForm.propNombre.trim(),
      cedula: newPatientForm.propCedula.trim(),
      telefono: newPatientForm.propTelefono.trim(),
      direccion: newPatientForm.propDireccion.trim()
    };

    const tempPropId = crypto.randomUUID();
    const tempPacId = crypto.randomUUID();

    const pacPayload = {
      propietario_id: tempPropId,
      nombre: newPatientForm.pacNombre.trim().toUpperCase(),
      especie: newPatientForm.pacEspecie,
      raza: newPatientForm.pacRaza.trim() || 'Mestizo',
      sexo: newPatientForm.pacSexo,
      edad: newPatientForm.pacEdad.trim() || 'N/E',
      peso_kg: parseFloat(newPatientForm.pacPeso) || 0,
      comportamiento: newPatientForm.pacComportamiento,
      alergias: newPatientForm.pacAlergias.trim() || 'Ninguna conocida',
      foto_url: newPatientForm.fotoUrl || ''
    };

    const basePropietarios = isEmptyCloud ? [] : propietarios;
    const basePacientes = isEmptyCloud ? [] : pacientes;
    const baseHospitalizaciones = isEmptyCloud ? [] : hospitalizaciones;

    setPropietarios([{ id: tempPropId, ...propPayload }, ...basePropietarios]);
    setPacientes([{ id: tempPacId, ...pacPayload }, ...basePacientes]);
    setSelectedPacienteId(tempPacId);

    let hospPayload = null;
    const tempHospId = crypto.randomUUID();
    if (newPatientForm.hospitalizarAhora) {
      hospPayload = {
        paciente_id: tempPacId,
        fecha_ingreso: TODAY_STR,
        fecha_retiro: null,
        dias_recomendados: '3 días',
        ubicacion: newPatientForm.ubicacion,
        condicion: 'EST',
        medico_responsable: activeDoctor.trim() || 'MVZ. Cristhian Romero',
        diagnostico: newPatientForm.diagnostico || 'Ingreso hospitalario',
        observaciones: '',
        foto_jaula_url: newPatientForm.fotoUrl || '',
        activa: true
      };
      setHospitalizaciones([{ id: tempHospId, ...hospPayload }, ...baseHospitalizaciones]);
    } else if (isEmptyCloud) {
      setHospitalizaciones([]);
    }

    setShowNewPatientModal(false);
    setNewPatientForm({
      propNombre: '', propCedula: '', propTelefono: '', propDireccion: '',
      pacNombre: '', pacEspecie: 'CANINO', pacRaza: '', pacSexo: 'M',
      pacEdad: '', pacPeso: '', pacComportamiento: 'D', pacAlergias: 'Ninguna conocida',
      fotoUrl: '', hospitalizarAhora: true, ubicacion: 'HOSPITAL GENERAL', diagnostico: ''
    });

    if (dbStatus === 'connected') {
      try {
        const [savedProp] = await sbFetch('propietarios', { method: 'POST', body: JSON.stringify(propPayload) });
        const realPropId = savedProp.id;
        setPropietarios((prev) => prev.map((p) => (p.id === tempPropId ? savedProp : p)));

        const [savedPac] = await sbFetch('pacientes', {
          method: 'POST',
          body: JSON.stringify({ ...pacPayload, propietario_id: realPropId })
        });
        const realPacId = savedPac.id;
        setPacientes((prev) => prev.map((p) => (p.id === tempPacId ? savedPac : p)));
        setSelectedPacienteId(realPacId);
        setIsEmptyCloud(false);

        if (hospPayload) {
          const [savedHosp] = await sbFetch('hospitalizaciones', {
            method: 'POST',
            body: JSON.stringify({ ...hospPayload, paciente_id: realPacId })
          });
          setHospitalizaciones((prev) => prev.map((h) => (h.id === tempHospId ? savedHosp : h)));
        }
        notify(`Paciente ${pacPayload.nombre} guardado en Supabase`);
      } catch (err) {
        notify(`Error al guardar en nube: ${err.message}`, 'error');
      }
    } else {
      notify(`Paciente ${pacPayload.nombre} guardado localmente`);
    }
  };

  const handleSaveConsulta = async (e) => {
    e.preventDefault();
    if (!currentPaciente || !newConsulta.motivo.trim()) return;

    const payload = {
      paciente_id: currentPaciente.id,
      fecha: TODAY_STR,
      ...newConsulta
    };
    const tempId = crypto.randomUUID();
    setConsultas((prev) => [{ id: tempId, ...payload }, ...prev]);
    setNewConsulta({
      medico: activeDoctor.trim() || 'MVZ. Cristhian Romero', motivo: '', anamnesis: '',
      temperatura: '', fc: '', fr: '', trc: '2 seg', mucosas: 'Rosadas',
      deshidratacion: '0%', examen_fisico: '', diferenciales: '',
      diagnostico: '', tratamiento: '', observaciones: ''
    });
    notify('Consulta clínica guardada');

    if (dbStatus === 'connected') {
      try {
        const res = await sbFetch('consultas', { method: 'POST', body: JSON.stringify(payload) });
        if (res?.[0]) setConsultas((prev) => prev.map((c) => (c.id === tempId ? res[0] : c)));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSavePreventivo = async (e) => {
    e.preventDefault();
    if (!currentPaciente || !newPrev.producto.trim()) return;

    const payload = {
      paciente_id: currentPaciente.id,
      ...newPrev,
      proxima_fecha: newPrev.proxima_fecha || null
    };
    const tempId = crypto.randomUUID();
    setPreventivos((prev) => [{ id: tempId, ...payload }, ...prev]);
    setNewPrev({ tipo: 'Vacuna', producto: '', dosis: '', fecha_aplicacion: TODAY_STR, proxima_fecha: '', observaciones: '' });
    notify('Control preventivo registrado');

    if (dbStatus === 'connected') {
      try {
        const res = await sbFetch('preventivos', { method: 'POST', body: JSON.stringify(payload) });
        if (res?.[0]) setPreventivos((prev) => prev.map((p) => (p.id === tempId ? res[0] : p)));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleUploadToDrive = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentPaciente) return;

    setUploadingDrive(true);
    try {
      const base64Full = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Data = base64Full.split(',')[1];
      const folderName = `${currentPaciente.nombre} - ${currentPropietario?.nombre || 'PROPIETARIO'}`.toUpperCase();

      let driveFileUrl = '';
      let driveFolderUrl = '';

      try {
        const res = await fetch(DRIVE_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'upload',
            folderName,
            fileName: `${examForm.categoria}_${TODAY_STR}_${file.name}`,
            mimeType: file.type || 'application/octet-stream',
            base64: base64Data
          })
        });
        const json = await res.json();
        driveFileUrl = json.fileUrl || json.url || json.viewUrl || '';
        driveFolderUrl = json.folderUrl || '';
      } catch {
        driveFileUrl = base64Full.length < 180000 ? base64Full : 'https://drive.google.com/drive/my-drive';
      }

      const adjPayload = {
        paciente_id: currentPaciente.id,
        categoria: examForm.categoria,
        nombre_archivo: file.name,
        drive_file_url: driveFileUrl || 'https://drive.google.com/drive/my-drive',
        drive_folder_url: driveFolderUrl,
        fecha: TODAY_STR,
        notas: examForm.notas
      };

      const tempId = crypto.randomUUID();
      setAdjuntos((prev) => [{ id: tempId, ...adjPayload }, ...prev]);
      setExamForm({ categoria: 'Hemograma', notas: '' });
      notify(`Examen guardado en carpeta Drive: ${folderName}`);

      if (dbStatus === 'connected') {
        const saved = await sbFetch('adjuntos', { method: 'POST', body: JSON.stringify(adjPayload) });
        if (saved?.[0]) setAdjuntos((prev) => prev.map((a) => (a.id === tempId ? saved[0] : a)));
      }
    } catch (err) {
      notify(`Error subiendo examen: ${err.message}`, 'error');
    } finally {
      setUploadingDrive(false);
      e.target.value = '';
    }
  };

  const sendExamWhatsApp = (adj) => {
    const rawPhone = (currentPropietario?.telefono || '').replace(/\D/g, '');
    const phone = rawPhone.startsWith('0') ? `593${rawPhone.slice(1)}` : rawPhone;
    const isHttpLink = adj.drive_file_url?.startsWith('http');
    const text = encodeURIComponent(
      `Hola ${currentPropietario?.nombre || ''}, le saludamos de *Clínica Veterinaria El Pibe* 🐾.\n\n` +
      `Compartimos el resultado de *${adj.categoria}* (${adj.fecha}) de *${currentPaciente?.nombre}*:\n` +
      `${isHttpLink ? adj.drive_file_url : 'Documento disponible en expediente clínico.'}\n\n` +
      `${adj.notas ? `Observación: ${adj.notas}` : ''}`
    );
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  const filteredPacientes = pacientes.filter((p) => {
    const prop = propietarios.find((pr) => pr.id === p.propietario_id);
    const q = searchQuery.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      (prop?.nombre || '').toLowerCase().includes(q) ||
      (prop?.cedula || '').includes(q)
    );
  });

  const activeCages = hospitalizaciones.filter((h) => {
    if (!h.activa) return false;
    if (cageFilter === 'TODAS') return true;
    return h.ubicacion === cageFilter;
  });

  const behaviorBadge = {
    D: { label: 'Dócil', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    I: { label: 'Inquieto', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    A: { label: 'Agresivo', cls: 'bg-rose-100 text-rose-800 border-rose-200' }
  }[currentPaciente?.comportamiento || 'D'] || { label: 'Dócil', cls: 'bg-emerald-100 text-emerald-800' };

  const conditionBadge = {
    EST: { label: 'ESTABLE', cls: 'bg-emerald-500 text-white' },
    CRIT: { label: 'CRÍTICO', cls: 'bg-rose-600 text-white animate-pulse' },
    OBS: { label: 'OBSERVACIÓN', cls: 'bg-amber-500 text-white' }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-semibold flex items-center gap-2 ${
            toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toast.msg}</span>
        </div>
      )}

      <CameraCaptureModal
        isOpen={Boolean(cameraTarget)}
        onClose={() => setCameraTarget(null)}
        onCapture={(dataUrl) => handleUpdatePhoto(cameraTarget, dataUrl)}
        title={
          cameraTarget?.type === 'jaula' || cameraTarget?.type === 'jaula_id'
            ? 'Foto de Paciente en Jaula'
            : 'Fotografía del Paciente'
        }
      />

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 leading-none">
                CLÍNICA VETERINARIA <span className="text-teal-700">EL PIBE</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Sistema de Historiales Clínicos y Hospitalización
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                dbStatus === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {dbStatus === 'connected' ? 'Supabase Nube' : 'Modo Local'}
              </span>
            </div>

            <div className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200">
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Drive Conectado</span>
            </div>

            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              <button
                onClick={() => setViewMode('ficha')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === 'ficha'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Expediente</span>
              </button>
              <button
                onClick={() => setViewMode('jaulas')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  viewMode === 'jaulas'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Jaulas Activas ({activeCages.length})</span>
              </button>
            </div>

            <button
              onClick={() => setShowNewPatientModal(true)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Paciente</span>
            </button>
          </div>
        </div>

        {dbStatus === 'connected' && isEmptyCloud && (
          <div className="bg-teal-900 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
            <span>
              Base de datos lista: registra un <strong>Nuevo Paciente</strong> o carga los de ejemplo.
            </span>
            <button
              onClick={handleSeedCloudDemo}
              disabled={seeding}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-lg flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              {seeding ? 'Sincronizando...' : 'Guardar Demo (Chavo) en Nube'}
            </button>
          </div>
        )}
      </header>

      {viewMode === 'jaulas' ? (
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">
                Tablero de Reconocimiento de Jaulas Activas
              </h2>
              <p className="text-xs text-slate-500">
                Identificación visual rápida por área hospitalaria y condición clínica
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {['TODAS', 'INFECTOLOGIA', 'HOSPITAL GENERAL', 'UCI'].map((area) => (
                <button
                  key={area}
                  onClick={() => setCageFilter(area)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                    cageFilter === area
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeCages.map((hosp) => {
              const pac = pacientes.find((p) => p.id === hosp.paciente_id);
              const prop = propietarios.find((pr) => pr.id === pac?.propietario_id);
              const cond = conditionBadge[hosp.condicion] || conditionBadge.EST;

              return (
                <div
                  key={hosp.id}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col"
                >
                  <div className="relative h-48 bg-slate-900">
                    {hosp.foto_jaula_url || pac?.foto_url ? (
                      <img
                        src={hosp.foto_jaula_url || pac?.foto_url}
                        alt={pac?.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                        Sin foto de jaula
                      </div>
                    )}
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[11px] font-bold">
                      {hosp.ubicacion}
                    </span>
                    <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${cond.cls}`}>
                      {cond.label}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-extrabold text-slate-900">{pac?.nombre}</h3>
                        <span className="text-xs font-semibold text-slate-500">
                          {pac?.especie} • {pac?.peso_kg} kg
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Prop: <strong className="text-slate-700">{prop?.nombre}</strong>
                      </p>
                      <p className="mt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {hosp.diagnostico}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <PhotoActionButtons
                        compact
                        onImageSelected={(url) => handleUpdatePhoto({ type: 'jaula_id', id: hosp.id }, url)}
                        onOpenCamera={() => setCameraTarget({ type: 'jaula_id', id: hosp.id })}
                      />
                      <button
                        onClick={() => {
                          setSelectedPacienteId(pac.id);
                          setActiveTab('hospitalizacion');
                          setViewMode('ficha');
                        }}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg"
                      >
                        Abrir Ficha
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <aside className="lg:col-span-3 space-y-3">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mascota o dueño..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="space-y-1.5 max-h-[62vh] overflow-y-auto pr-1">
                {filteredPacientes.map((pac) => {
                  const prop = propietarios.find((pr) => pr.id === pac.propietario_id);
                  const isHosp = hospitalizaciones.some((h) => h.paciente_id === pac.id && h.activa);
                  const isSelected = pac.id === currentPaciente?.id;

                  return (
                    <button
                      key={pac.id}
                      onClick={() => setSelectedPacienteId(pac.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center gap-2.5 ${
                        isSelected
                          ? 'bg-teal-50/90 border-teal-500 shadow-xs'
                          : 'bg-white border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <img
                        src={
                          pac.foto_url ||
                          'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=150&q=60'
                        }
                        alt={pac.nombre}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-xs text-slate-900 truncate">
                            {pac.nombre}
                          </span>
                          {isHosp && (
                            <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded bg-rose-100 text-rose-700 shrink-0">
                              HOSP
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{prop?.nombre}</p>
                        <p className="text-[10px] text-slate-400">
                          {pac.especie} • {pac.raza}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {currentPaciente && (
            <section className="lg:col-span-9 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="space-y-2 shrink-0">
                      <img
                        src={
                          currentPaciente.foto_url ||
                          'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=250&q=70'
                        }
                        alt={currentPaciente.nombre}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-teal-500/30 shadow-xs"
                      />
                      <PhotoActionButtons
                        compact
                        onImageSelected={(url) => handleUpdatePhoto({ type: 'paciente' }, url)}
                        onOpenCamera={() => setCameraTarget({ type: 'paciente' })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                          {currentPaciente.nombre}
                        </h2>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                          {currentPaciente.especie}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border text-xs font-bold ${behaviorBadge.cls}`}>
                          {behaviorBadge.label}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium">
                        Raza: <strong>{currentPaciente.raza}</strong> • Sexo:{' '}
                        <strong>{currentPaciente.sexo === 'M' ? 'Macho' : 'Hembra'}</strong> • Edad:{' '}
                        <strong>{currentPaciente.edad}</strong> • Peso:{' '}
                        <strong className="text-teal-700">{currentPaciente.peso_kg} kg</strong>
                      </p>

                      {currentPaciente.alergias && currentPaciente.alergias !== 'Ninguna conocida' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Alergias: {currentPaciente.alergias}</span>
                        </div>
                      )}

                      <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-teal-600" />
                          <strong>{currentPropietario?.nombre}</strong>
                        </span>
                        {currentPropietario?.telefono && (
                          <a
                            href={`https://wa.me/${currentPropietario.telefono.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {currentPropietario.telefono}
                          </a>
                        )}
                        {currentPropietario?.direccion && (
                          <span className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3.5 h-3.5" />
                            {currentPropietario.direccion}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
                  {[
                    {
                      id: 'hospitalizacion',
                      label: `Hospitalización${pastHosps.length > 0 ? ` (${pastHosps.length} prev.)` : ''}`,
                      icon: Activity
                    },
                    { id: 'consultas', label: `Consultas (${currentConsultas.length})`, icon: Stethoscope },
                    { id: 'preventivos', label: `Preventivos (${currentPreventivos.length})`, icon: ShieldCheck },
                    { id: 'examenes', label: `Exámenes y Drive (${currentAdjuntos.length})`, icon: FileText }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
                          active
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTab === 'hospitalizacion' && (
                <div className="space-y-5">
                  {!currentHosp ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-3">
                      <Activity className="w-9 h-9 text-slate-300 mx-auto" />
                      <h3 className="font-bold text-slate-800">
                        {currentPaciente.nombre} no está hospitalizado actualmente
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Puedes iniciar un nuevo ingreso hospitalario o revisar abajo sus hospitalizaciones anteriores.
                      </p>
                      <button
                        onClick={handleAdmitPatient}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        Nuevo Ingreso a Hospitalización
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                      <div className="xl:col-span-8 space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                            <span className="text-xs font-extrabold text-teal-700 uppercase">
                              Hospitalización Activa
                            </span>
                            <button
                              type="button"
                              onClick={openDischargeModal}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl flex items-center gap-1.5 shadow-xs transition"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Dar de Alta Médica</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Área / Jaula
                              </label>
                              <select
                                value={currentHosp.ubicacion}
                                onChange={(e) => updateHospField('ubicacion', e.target.value)}
                                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                              >
                                <option value="HOSPITAL GENERAL">HOSPITAL GENERAL</option>
                                <option value="INFECTOLOGIA">INFECTOLOGIA</option>
                                <option value="UCI">UCI</option>
                                <option value="POST-QUIRÚRGICO">POST-QUIRÚRGICO</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Condición Clínica
                              </label>
                              <select
                                value={currentHosp.condicion}
                                onChange={(e) => updateHospField('condicion', e.target.value)}
                                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                              >
                                <option value="EST">ESTABLE (EST)</option>
                                <option value="OBS">OBSERVACIÓN (OBS)</option>
                                <option value="CRIT">CRÍTICO (CRIT)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Fecha Ingreso
                              </label>
                              <input
                                type="date"
                                value={currentHosp.fecha_ingreso || TODAY_STR}
                                onChange={(e) => updateHospField('fecha_ingreso', e.target.value)}
                                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Diagnóstico Presuntivo / Definitivo
                              </label>
                              <input
                                type="text"
                                value={currentHosp.diagnostico || ''}
                                onChange={(e) => updateHospField('diagnostico', e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                                Indicaciones / Observaciones
                              </label>
                              <input
                                type="text"
                                value={currentHosp.observaciones || ''}
                                onChange={(e) => updateHospField('observaciones', e.target.value)}
                                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                              />
                            </div>
                          </div>
                        </div>

                        {/* GRILLA HORARIA CON AUDITORÍA DE MÉDICO RESPONSABLE */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-teal-50/70 border border-teal-200/80 p-3 rounded-xl">
                            <div>
                              <h3 className="text-sm font-extrabold text-slate-900">
                                Plan Terapéutico y Registro de Aplicación
                              </h3>
                              <p className="text-[11px] text-slate-600">
                                Toques: <strong className="text-amber-700">Programado</strong> →{' '}
                                <strong className="text-emerald-700">✓ Aplicado</strong> →{' '}
                                <strong className="text-rose-700">✗ Faltó</strong>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
                              <div className="min-w-[200px]">
                                <label className="block text-[9px] font-extrabold uppercase text-teal-800">
                                  Médico / Responsable que aplica
                                </label>
                                <input
                                  type="text"
                                  value={activeDoctor}
                                  onChange={(e) => setActiveDoctor(e.target.value)}
                                  placeholder="Nombre del médico de turno"
                                  className="w-full text-xs font-bold bg-white border border-teal-300 rounded-lg px-2.5 py-1 text-slate-900 focus:outline-none focus:border-teal-600"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-900 text-white">
                                  <th className="text-left py-2 px-2.5 rounded-tl-xl">Medicina</th>
                                  <th className="text-left py-2 px-2">Dosis / Vía</th>
                                  <th className="text-center py-2 px-1.5">Frec.</th>
                                  {HOURS.map((h) => (
                                    <th key={h} className="text-center py-2 px-1.5 min-w-[66px]">
                                      {h}
                                    </th>
                                  ))}
                                  <th className="py-2 px-2 rounded-tr-xl"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {currentMeds.map((med) => (
                                  <tr key={med.id} className="hover:bg-slate-50">
                                    <td className="py-2 px-2.5 font-extrabold text-slate-800">
                                      {med.medicina}
                                    </td>
                                    <td className="py-2 px-2 text-slate-600">
                                      {med.dosis} <span className="text-[10px] font-bold text-teal-700">({med.via})</span>
                                    </td>
                                    <td className="py-2 px-1.5 text-center font-semibold text-slate-500">
                                      {med.frecuencia}
                                    </td>
                                    {HOURS.map((h) => {
                                      const entry = parseHourEntry(med.horarios_json?.[h]);
                                      const shortDoc = entry.medico
                                        ? entry.medico.replace(/^MVZ\.?\s*/i, '').split(' ')[0]
                                        : '';

                                      return (
                                        <td key={h} className="py-1.5 px-1 text-center">
                                          <button
                                            type="button"
                                            onClick={() => toggleMedHour(med, h)}
                                            title={
                                              entry.status === 'done'
                                                ? `Aplicado por ${entry.medico || 'Médico'} ${entry.hora ? `a las ${entry.hora}` : ''}`
                                                : entry.status === 'missed'
                                                ? `FALTÓ medicación (Registrado por ${entry.medico || 'Médico'})`
                                                : entry.status === 'pending'
                                                ? 'Programado (tocar para marcar Aplicado)'
                                                : 'Tocar para programar'
                                            }
                                            className={`w-14 min-h-[38px] py-1 px-1 rounded-lg border font-bold flex flex-col items-center justify-center mx-auto transition ${
                                              entry.status === 'done'
                                                ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                                                : entry.status === 'missed'
                                                ? 'bg-rose-600 border-rose-700 text-white shadow-xs'
                                                : entry.status === 'pending'
                                                ? 'bg-amber-200 border-amber-400 text-amber-900'
                                                : 'bg-slate-50 border-slate-200 text-slate-300 hover:border-slate-300'
                                            }`}
                                          >
                                            {entry.status === 'done' ? (
                                              <>
                                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                {shortDoc && (
                                                  <span className="text-[9px] leading-tight font-semibold truncate max-w-[50px]">
                                                    {shortDoc}
                                                  </span>
                                                )}
                                              </>
                                            ) : entry.status === 'missed' ? (
                                              <>
                                                <X className="w-3.5 h-3.5 stroke-[3]" />
                                                <span className="text-[8px] leading-tight uppercase font-extrabold">
                                                  Faltó
                                                </span>
                                              </>
                                            ) : entry.status === 'pending' ? (
                                              <Clock className="w-3.5 h-3.5" />
                                            ) : (
                                              '·'
                                            )}
                                          </button>
                                        </td>
                                      );
                                    })}
                                    <td className="py-1.5 px-1 text-right">
                                      <button
                                        onClick={() => handleDeleteMedication(med.id)}
                                        className="p-1 text-slate-400 hover:text-rose-600"
                                        title="Eliminar fármaco"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Bitácora legible de quién medicó o qué dosis faltó */}
                          {currentMeds.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
                              <p className="text-[10px] font-extrabold uppercase text-slate-500">
                                Bitácora de Administración del Día
                              </p>
                              <div className="space-y-1 text-[11px]">
                                {currentMeds.map((med) => {
                                  const entries = HOURS.map((hr) => ({
                                    hr,
                                    ...parseHourEntry(med.horarios_json?.[hr])
                                  })).filter((e) => e.status !== '');

                                  if (entries.length === 0) return null;

                                  return (
                                    <div key={med.id} className="flex flex-wrap items-center gap-1.5">
                                      <strong className="text-slate-800">{med.medicina}:</strong>
                                      {entries.map((e) => (
                                        <span
                                          key={e.hr}
                                          className={`px-2 py-0.5 rounded-md font-semibold ${
                                            e.status === 'done'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : e.status === 'missed'
                                              ? 'bg-rose-100 text-rose-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {e.hr}{' '}
                                          {e.status === 'done'
                                            ? `✓ Aplicó: ${e.medico || 'Médico'}${e.hora ? ` (${e.hora})` : ''}`
                                            : e.status === 'missed'
                                            ? `✗ FALTÓ (${e.medico || 'Sin registro'})`
                                            : '• Pendiente'}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <form
                            onSubmit={handleAddMedication}
                            className="pt-2 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-6 gap-2"
                          >
                            <input
                              type="text"
                              placeholder="Fármaco (ej. Omeprazol)"
                              value={newMed.medicina}
                              onChange={(e) => setNewMed({ ...newMed, medicina: e.target.value })}
                              className="col-span-2 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                            />
                            <input
                              type="text"
                              placeholder="Dosis (ej. 1.2 ml)"
                              value={newMed.dosis}
                              onChange={(e) => setNewMed({ ...newMed, dosis: e.target.value })}
                              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5"
                            />
                            <select
                              value={newMed.via}
                              onChange={(e) => setNewMed({ ...newMed, via: e.target.value })}
                              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
                            >
                              <option value="IV">IV</option>
                              <option value="VO">VO</option>
                              <option value="SC">SC</option>
                              <option value="IM">IM</option>
                            </select>
                            <select
                              value={newMed.frecuencia}
                              onChange={(e) => setNewMed({ ...newMed, frecuencia: e.target.value })}
                              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
                            >
                              <option value="C24">C24h</option>
                              <option value="C12">C12h</option>
                              <option value="C8">C8h</option>
                              <option value="C6">C6h</option>
                            </select>
                            <button
                              type="submit"
                              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg px-3 py-1.5 flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Añadir
                            </button>
                          </form>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Monitoreo Clínico por Turnos
                            </h3>
                            <input
                              type="date"
                              value={selectedDate}
                              onChange={(e) => setSelectedDate(e.target.value)}
                              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1"
                            />
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-100 text-slate-700">
                                  <th className="text-left py-2 px-2.5 rounded-tl-lg">Parámetro</th>
                                  {TURNOS.map((t) => (
                                    <th key={t.key} className="text-center py-2 px-2">
                                      {t.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {[
                                  { key: 'responsable', label: 'Responsable', placeholder: 'Nombre' },
                                  { key: 'temperatura', label: 'Temperatura (°C)', placeholder: '38.5' },
                                  { key: 'conciencia', label: 'Conciencia (ACT/LET/EST)', placeholder: 'ACT' },
                                  { key: 'comida', label: 'Apetito / Comida', placeholder: 'Come bien' },
                                  { key: 'vomitos', label: 'Vómitos (S / N)', placeholder: 'N' },
                                  { key: 'diarreas', label: 'Diarreas (S / N)', placeholder: 'N' },
                                  { key: 'orina', label: 'Orina (S / N)', placeholder: 'S' },
                                  { key: 'heces', label: 'Heces (S / N)', placeholder: 'N' },
                                  { key: 'deshidratacion', label: 'Deshidratación (%)', placeholder: '0%' },
                                  { key: 'fluidoterapia_ml_h', label: 'Fluidoterapia (ml/h)', placeholder: '30' }
                                ].map((row) => (
                                  <tr key={row.key}>
                                    <td className="py-1.5 px-2.5 font-semibold text-slate-700">
                                      {row.label}
                                    </td>
                                    {TURNOS.map((t) => {
                                      const rec = monitoreos.find(
                                        (m) =>
                                          m.hospitalizacion_id === currentHosp.id &&
                                          m.fecha === selectedDate &&
                                          m.turno === t.key
                                      );
                                      return (
                                        <td key={t.key} className="py-1 px-1.5">
                                          <input
                                            type="text"
                                            value={rec?.[row.key] || ''}
                                            placeholder={row.placeholder}
                                            onChange={(e) =>
                                              updateMonitoreoCell(t.key, row.key, e.target.value)
                                            }
                                            className="w-full text-center text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 px-1.5 focus:bg-white focus:border-teal-500 focus:outline-none"
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="xl:col-span-4 space-y-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Foto en Jaula
                            </h3>
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[11px] font-bold border border-teal-200">
                              {currentHosp.ubicacion}
                            </span>
                          </div>

                          <div className="relative rounded-xl overflow-hidden bg-slate-900 aspect-[4/3] border border-slate-200">
                            {currentHosp.foto_jaula_url || currentPaciente.foto_url ? (
                              <img
                                src={currentHosp.foto_jaula_url || currentPaciente.foto_url}
                                alt="Paciente en jaula"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
                                <Camera className="w-8 h-8 mb-1 opacity-50" />
                                <span>Toma una foto del paciente en su jaula</span>
                              </div>
                            )}
                          </div>

                          <PhotoActionButtons
                            onImageSelected={(url) => handleUpdatePhoto({ type: 'jaula' }, url)}
                            onOpenCamera={() => setCameraTarget({ type: 'jaula' })}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* HISTORIAL DE HOSPITALIZACIONES DADAS DE ALTA CON AUDITORÍA DE MÉDICOS */}
                  {pastHosps.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-teal-700" />
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Historial de Hospitalizaciones Anteriores ({pastHosps.length})
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {pastHosps.map((hosp) => {
                          const histMeds = medicaciones.filter((m) => m.hospitalizacion_id === hosp.id);
                          const histMons = monitoreos.filter((m) => m.hospitalizacion_id === hosp.id);
                          const isExpanded = expandedHistoryId === hosp.id;

                          return (
                            <div
                              key={hosp.id}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white text-[11px] font-bold">
                                    ALTA MÉDICA
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-900">
                                    Ingreso: {hosp.fecha_ingreso} → Alta: {hosp.fecha_retiro || 'Registrada'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 text-[11px] font-extrabold">
                                    Estancia: {hosp.dias_recomendados || calculateStayDays(hosp.fecha_ingreso, hosp.fecha_retiro)}
                                  </span>
                                </div>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {hosp.ubicacion} • {hosp.medico_responsable}
                                </span>
                              </div>

                              <p className="text-xs text-slate-800">
                                <strong>Diagnóstico:</strong> {hosp.diagnostico || 'Sin diagnóstico registrado'}
                              </p>

                              {hosp.observaciones && (
                                <p className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 whitespace-pre-line">
                                  {hosp.observaciones}
                                </p>
                              )}

                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-slate-500 font-semibold">
                                  {histMeds.length} medicamento(s) • {histMons.length} registro(s) de turno
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedHistoryId(isExpanded ? null : hosp.id)}
                                  className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-teal-700 flex items-center gap-1"
                                >
                                  <span>{isExpanded ? 'Ocultar detalle' : 'Ver medicación y turnos'}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="pt-2 border-t border-slate-200 space-y-3">
                                  <div>
                                    <h4 className="text-[11px] font-extrabold uppercase text-slate-600 mb-1.5">
                                      Registro de Medicación y Médico Responsable por Toma
                                    </h4>
                                    {histMeds.length === 0 ? (
                                      <p className="text-xs text-slate-500">No se registraron medicamentos.</p>
                                    ) : (
                                      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                        <table className="w-full text-xs">
                                          <thead className="bg-slate-800 text-white">
                                            <tr>
                                              <th className="text-left py-1.5 px-2.5">Fármaco</th>
                                              <th className="text-left py-1.5 px-2">Dosis / Vía</th>
                                              <th className="text-left py-1.5 px-2">Detalle de Tomas (Quién aplicó / Faltantes)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {histMeds.map((m) => {
                                              const entries = HOURS.map((hr) => ({
                                                hr,
                                                ...parseHourEntry(m.horarios_json?.[hr])
                                              })).filter((e) => e.status !== '');

                                              return (
                                                <tr key={m.id}>
                                                  <td className="py-2 px-2.5 font-bold text-slate-800 align-top">
                                                    {m.medicina}
                                                  </td>
                                                  <td className="py-2 px-2 text-slate-600 align-top">
                                                    {m.dosis} ({m.via}) • {m.frecuencia}
                                                  </td>
                                                  <td className="py-2 px-2">
                                                    {entries.length === 0 ? (
                                                      <span className="text-slate-400">Sin tomas marcadas</span>
                                                    ) : (
                                                      <div className="flex flex-wrap gap-1.5">
                                                        {entries.map((e) => (
                                                          <span
                                                            key={e.hr}
                                                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                                              e.status === 'done'
                                                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                                : e.status === 'missed'
                                                                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                            }`}
                                                          >
                                                            {e.hr}:{' '}
                                                            {e.status === 'done'
                                                              ? `✓ Aplicó ${e.medico || 'Médico'}${e.hora ? ` (${e.hora})` : ''}`
                                                              : e.status === 'missed'
                                                              ? `✗ FALTÓ DE MEDICAR (${e.medico || 'Sin registro'})`
                                                              : 'Pendiente'}
                                                          </span>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>

                                  {histMons.length > 0 && (
                                    <div>
                                      <h4 className="text-[11px] font-extrabold uppercase text-slate-600 mb-1.5">
                                        Controles de Turno Registrados
                                      </h4>
                                      <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
                                        <table className="w-full text-[11px]">
                                          <thead className="bg-slate-100 text-slate-700">
                                            <tr>
                                              <th className="text-left py-1.5 px-2">Fecha / Turno</th>
                                              <th className="text-left py-1.5 px-2">T°</th>
                                              <th className="text-left py-1.5 px-2">Comida</th>
                                              <th className="text-left py-1.5 px-2">Vóm / Diar</th>
                                              <th className="text-left py-1.5 px-2">Fluido</th>
                                              <th className="text-left py-1.5 px-2">Resp.</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {histMons.map((mon) => (
                                              <tr key={mon.id}>
                                                <td className="py-1.5 px-2 font-bold">{mon.fecha} ({mon.turno})</td>
                                                <td className="py-1.5 px-2">{mon.temperatura || '-'}</td>
                                                <td className="py-1.5 px-2">{mon.comida || '-'}</td>
                                                <td className="py-1.5 px-2">{mon.vomitos}/{mon.diarreas}</td>
                                                <td className="py-1.5 px-2">{mon.fluidoterapia_ml_h ? `${mon.fluidoterapia_ml_h} ml/h` : '-'}</td>
                                                <td className="py-1.5 px-2">{mon.responsable || '-'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'consultas' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleSaveConsulta}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3"
                  >
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Registrar Nueva Consulta Clínica
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Motivo de consulta *"
                        value={newConsulta.motivo}
                        onChange={(e) => setNewConsulta({ ...newConsulta, motivo: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Médico veterinario"
                        value={newConsulta.medico}
                        onChange={(e) => setNewConsulta({ ...newConsulta, medico: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <input
                        type="text"
                        placeholder="Temp (°C)"
                        value={newConsulta.temperatura}
                        onChange={(e) => setNewConsulta({ ...newConsulta, temperatura: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                      <input
                        type="text"
                        placeholder="FC (lpm)"
                        value={newConsulta.fc}
                        onChange={(e) => setNewConsulta({ ...newConsulta, fc: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                      <input
                        type="text"
                        placeholder="FR (rpm)"
                        value={newConsulta.fr}
                        onChange={(e) => setNewConsulta({ ...newConsulta, fr: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                      <input
                        type="text"
                        placeholder="TRC"
                        value={newConsulta.trc}
                        onChange={(e) => setNewConsulta({ ...newConsulta, trc: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Mucosas"
                        value={newConsulta.mucosas}
                        onChange={(e) => setNewConsulta({ ...newConsulta, mucosas: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                      <input
                        type="text"
                        placeholder="Deshidr. %"
                        value={newConsulta.deshidratacion}
                        onChange={(e) => setNewConsulta({ ...newConsulta, deshidratacion: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Anamnesis y hallazgos al examen físico..."
                      value={newConsulta.examen_fisico}
                      onChange={(e) => setNewConsulta({ ...newConsulta, examen_fisico: e.target.value })}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <textarea
                        rows={2}
                        placeholder="Diagnósticos diferenciales (lista de sospechas clínicas)..."
                        value={newConsulta.diferenciales}
                        onChange={(e) => setNewConsulta({ ...newConsulta, diferenciales: e.target.value })}
                        className="w-full text-xs bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2"
                      />
                      <textarea
                        rows={2}
                        placeholder="Diagnóstico presuntivo / definitivo y plan terapéutico..."
                        value={newConsulta.tratamiento}
                        onChange={(e) => setNewConsulta({ ...newConsulta, tratamiento: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Guardar Consulta
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {currentConsultas.map((c) => (
                      <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-teal-700">{c.fecha}</span>
                          <span className="text-xs text-slate-500 font-semibold">{c.medico}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900">{c.motivo}</h4>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                          <span><strong>T°:</strong> {c.temperatura || '-'}</span>
                          <span>• <strong>FC:</strong> {c.fc || '-'}</span>
                          <span>• <strong>FR:</strong> {c.fr || '-'}</span>
                          <span>• <strong>Mucosas:</strong> {c.mucosas || '-'}</span>
                          <span>• <strong>Deshidr:</strong> {c.deshidratacion || '-'}</span>
                        </div>
                        {c.examen_fisico && <p className="text-xs text-slate-700">{c.examen_fisico}</p>}
                        {c.diferenciales && (
                          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2 rounded-lg">
                            <strong>Diferenciales:</strong> {c.diferenciales}
                          </p>
                        )}
                        {c.tratamiento && (
                          <p className="text-xs text-slate-800">
                            <strong>Plan / Tratamiento:</strong> {c.tratamiento}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'preventivos' && (
                <div className="space-y-4">
                  <form
                    onSubmit={handleSavePreventivo}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-6 gap-2.5"
                  >
                    <select
                      value={newPrev.tipo}
                      onChange={(e) => setNewPrev({ ...newPrev, tipo: e.target.value })}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-bold"
                    >
                      <option value="Vacuna">Vacuna</option>
                      <option value="Desp. Interna">Desp. Interna</option>
                      <option value="Desp. Externa">Desp. Externa</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Producto / Biológico *"
                      value={newPrev.producto}
                      onChange={(e) => setNewPrev({ ...newPrev, producto: e.target.value })}
                      className="sm:col-span-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                    <input
                      type="text"
                      placeholder="Dosis"
                      value={newPrev.dosis}
                      onChange={(e) => setNewPrev({ ...newPrev, dosis: e.target.value })}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    />
                    <div>
                      <input
                        type="date"
                        title="Próxima fecha"
                        value={newPrev.proxima_fecha}
                        onChange={(e) => setNewPrev({ ...newPrev, proxima_fecha: e.target.value })}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl px-3 py-2 flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Registrar
                    </button>
                  </form>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-900 text-white">
                        <tr>
                          <th className="text-left py-2.5 px-3">Tipo</th>
                          <th className="text-left py-2.5 px-3">Producto</th>
                          <th className="text-left py-2.5 px-3">Aplicación</th>
                          <th className="text-left py-2.5 px-3">Próximo Refuerzo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentPreventivos.map((pr) => (
                          <tr key={pr.id}>
                            <td className="py-2.5 px-3 font-bold text-teal-700">{pr.tipo}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {pr.producto} {pr.dosis ? `(${pr.dosis})` : ''}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">{pr.fecha_aplicacion}</td>
                            <td className="py-2.5 px-3">
                              {pr.proxima_fecha ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                  {pr.proxima_fecha}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'examenes' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Subir Exámenes a Google Drive
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Se guarda automáticamente en la carpeta{' '}
                          <strong>
                            {currentPaciente.nombre} - {currentPropietario?.nombre}
                          </strong>
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                        Apps Script Activo
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        value={examForm.categoria}
                        onChange={(e) => setExamForm({ ...examForm, categoria: e.target.value })}
                        className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      >
                        <option value="Hemograma">Hemograma</option>
                        <option value="Bioquímica Sanguínea">Bioquímica Sanguínea</option>
                        <option value="Ecografía">Ecografía</option>
                        <option value="Radiografía">Radiografía</option>
                        <option value="Citología">Citología</option>
                        <option value="Otro Examen">Otro Examen</option>
                      </select>

                      <input
                        type="text"
                        placeholder="Notas o interpretación rápida..."
                        value={examForm.notas}
                        onChange={(e) => setExamForm({ ...examForm, notas: e.target.value })}
                        className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                      />

                      <div className="relative overflow-hidden bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl px-4 py-2 flex items-center justify-center gap-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>{uploadingDrive ? 'Subiendo a Drive...' : 'Seleccionar PDF / Imagen'}</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          disabled={uploadingDrive}
                          onChange={handleUploadToDrive}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentAdjuntos.length === 0 ? (
                      <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                        Aún no hay exámenes registrados para {currentPaciente.nombre}.
                      </div>
                    ) : (
                      currentAdjuntos.map((adj) => (
                        <div
                          key={adj.id}
                          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-bold">
                                {adj.categoria}
                              </span>
                              <span className="text-[11px] text-slate-400">{adj.fecha}</span>
                            </div>
                            <h4 className="font-bold text-xs text-slate-900 mt-2 truncate">
                              {adj.nombre_archivo}
                            </h4>
                            {adj.notas && <p className="text-xs text-slate-600 mt-1">{adj.notas}</p>}
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                            <a
                              href={adj.drive_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Abrir Archivo
                            </a>
                            <button
                              type="button"
                              onClick={() => sendExamWhatsApp(adj)}
                              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              WhatsApp Dueño
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* MODAL DE ALTA MÉDICA HOSPITALARIA */}
      {showDischargeModal && currentHosp && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmDischarge}
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  Dar de Alta a {currentPaciente?.nombre}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDischargeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Fecha de Alta
                </label>
                <input
                  type="date"
                  required
                  value={dischargeForm.fecha_retiro}
                  onChange={(e) => {
                    const newExit = e.target.value;
                    setDischargeForm({
                      ...dischargeForm,
                      fecha_retiro: newExit,
                      dias_totales: calculateStayDays(currentHosp.fecha_ingreso, newExit)
                    });
                  }}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Total Días Hospitalizado
                </label>
                <input
                  type="text"
                  required
                  value={dischargeForm.dias_totales}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, dias_totales: e.target.value })}
                  className="w-full text-xs font-bold bg-teal-50 border border-teal-200 text-teal-900 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <p className="text-[11px] font-extrabold text-slate-700">
                Medicación que quedará archivada ({currentMeds.length}):
              </p>
              {currentMeds.length === 0 ? (
                <p className="text-xs text-slate-500">Sin medicamentos registrados.</p>
              ) : (
                <ul className="text-xs text-slate-600 space-y-1 max-h-28 overflow-y-auto">
                  {currentMeds.map((m) => (
                    <li key={m.id}>
                      • <strong>{m.medicina}</strong> ({m.dosis}, {m.via}, {m.frecuencia})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Indicaciones de Alta / Tratamiento en Casa
              </label>
              <textarea
                rows={3}
                placeholder="Ej. Dieta blanda por 3 días, continuar omeprazol 10 mg VO cada 24h por 5 días..."
                value={dischargeForm.notas_alta}
                onChange={(e) => setDischargeForm({ ...dischargeForm, notas_alta: e.target.value })}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDischargeModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs"
              >
                Confirmar Alta y Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {showNewPatientModal && (
        <div className="fixed inset-0 z-40 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleCreatePatient}
            className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-base text-slate-900">
                Registrar Nuevo Paciente
              </h3>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-extrabold uppercase text-teal-700">
                1. Datos del Propietario
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Nombre completo del propietario *"
                  value={newPatientForm.propNombre}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, propNombre: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Teléfono WhatsApp (ej. 0991234567)"
                  value={newPatientForm.propTelefono}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, propTelefono: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[11px] font-extrabold uppercase text-teal-700">
                2. Datos de la Mascota
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Nombre mascota *"
                  value={newPatientForm.pacNombre}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, pacNombre: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold"
                />
                <select
                  value={newPatientForm.pacEspecie}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, pacEspecie: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="CANINO">CANINO</option>
                  <option value="FELINO">FELINO</option>
                  <option value="EXÓTICO">EXÓTICO</option>
                </select>
                <input
                  type="text"
                  placeholder="Raza"
                  value={newPatientForm.pacRaza}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, pacRaza: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
                <select
                  value={newPatientForm.pacSexo}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, pacSexo: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="M">Macho</option>
                  <option value="H">Hembra</option>
                </select>
                <input
                  type="text"
                  placeholder="Edad (ej. 2 años)"
                  value={newPatientForm.pacEdad}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, pacEdad: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Peso (kg)"
                  value={newPatientForm.pacPeso}
                  onChange={(e) => setNewPatientForm({ ...newPatientForm, pacPeso: e.target.value })}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                {newPatientForm.fotoUrl && (
                  <img
                    src={newPatientForm.fotoUrl}
                    alt="Vista previa"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                  />
                )}
                <PhotoActionButtons
                  onImageSelected={(url) => setNewPatientForm({ ...newPatientForm, fotoUrl: url })}
                  onOpenCamera={() => setCameraTarget({ type: 'nuevo' })}
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPatientForm.hospitalizarAhora}
                  onChange={(e) =>
                    setNewPatientForm({ ...newPatientForm, hospitalizarAhora: e.target.checked })
                  }
                  className="rounded text-teal-600"
                />
                <span>Ingresar directamente a Hospitalización</span>
              </label>

              {newPatientForm.hospitalizarAhora && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <select
                    value={newPatientForm.ubicacion}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, ubicacion: e.target.value })}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold"
                  >
                    <option value="HOSPITAL GENERAL">HOSPITAL GENERAL</option>
                    <option value="INFECTOLOGIA">INFECTOLOGIA</option>
                    <option value="UCI">UCI</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Motivo / Diagnóstico de ingreso"
                    value={newPatientForm.diagnostico}
                    onChange={(e) => setNewPatientForm({ ...newPatientForm, diagnostico: e.target.value })}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewPatientModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Guardar Paciente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
