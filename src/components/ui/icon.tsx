import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BadgeCheck,
  Building2,
  Camera,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleUserRound,
  Clock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Filter,
  House,
  ImagePlus,
  Inbox,
  Info,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Signpost,
  SquarePlus,
  Store,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./cn";

/**
 * Mapa de nombres (heredados de Material Symbols) → icono Lucide.
 * Mantener la API por string permite migrar sin tocar cada llamada.
 */
const ICONS: Record<string, LucideIcon> = {
  account_balance_wallet: Wallet,
  account_circle: CircleUserRound,
  add: Plus,
  add_box: SquarePlus,
  arrow_back: ArrowLeft,
  arrow_up_right: ArrowUpRight,
  badge: BadgeCheck,
  building: Building2,
  call: Phone,
  camera: Camera,
  calculator: Calculator,
  check_circle: CircleCheck,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  dashboard: LayoutDashboard,
  delete: Trash2,
  download: Download,
  edit: Pencil,
  error: CircleAlert,
  expand_more: ChevronDown,
  filter: Filter,
  group: Users,
  groups: Users,
  home: House,
  image_plus: ImagePlus,
  info: Info,
  inventory_2: Package,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  map_pin: MapPin,
  payments: Banknote,
  pending_actions: Clock,
  person: User,
  person_add: UserPlus,
  point_of_sale: Store,
  progress_activity: LoaderCircle,
  receipt_long: ReceiptText,
  refresh: RefreshCw,
  save: Save,
  schedule: Clock,
  search: Search,
  send: Send,
  settings: Settings,
  signpost: Signpost,
  storefront: Store,
  sync_down: ArrowDownToLine,
  transfer: CreditCard,
  upload: Upload,
  verified: BadgeCheck,
  visibility: Eye,
  visibility_off: EyeOff,
  inbox: Inbox,
  metodo_bs: Banknote,
  metodo_efectivo: CreditCard,
  metodo_zelle: Send,
  metodo_binance: Landmark,
  estado_cuenta: ReceiptText,
};

export interface IconProps {
  /** Nombre del icono (ver mapa ICONS). */
  name: string;
  /** Tamaño en px. Por defecto 20. */
  size?: number;
  className?: string;
  /** Trazo. Apple usa ~1.8; 2 en tamaños pequeños. */
  strokeWidth?: number;
}

/** Icono del sistema basado en Lucide (SVG, sin webfont). */
export function Icon({ name, size = 20, className, strokeWidth = 1.8 }: IconProps) {
  const Cmp = ICONS[name] ?? Inbox;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      aria-hidden
      focusable={false}
    />
  );
}
