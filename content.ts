import { LOCATIONS_DATA, SERVICES_DATA, TEAM_DATA, TECHNOLOGIES_DATA, TESTIMONIALS_DATA } from './constants';
import { supabase } from './supabase';
import { Location, Service, ServiceCategory, TeamMember, Technology, Testimonial } from './types';

export type NavItem = {
    id: string;
    label: string;
};

export type HeroContent = {
    titlePrimary: string;
    titleAccent: string;
    subtitle: string;
    ctaLabel: string;
    videoUrl: string;
    slides: string[];
};

export type PhilosophyContent = {
    title: string;
    imageUrl: string;
    paragraphs: string[];
};

export type CtaContent = {
    title: string;
    description: string;
    buttonLabel: string;
};

export type FooterContent = {
    brandTitle: string;
    brandSubtitle: string;
    brandDescription: string;
    instagramLabel: string;
    instagramUrl: string;
};

export type SiteContent = {
    headerNav: NavItem[];
    hero: HeroContent;
    philosophy: PhilosophyContent;
    cta: CtaContent;
    footer: FooterContent;
    whatsappPhone: string;
    services: Service[];
    technologies: Technology[];
    team: TeamMember[];
    testimonials: Testimonial[];
    locations: Location[];
};

export const LOCAL_STORAGE_CONTENT_KEY = 'be-aesthetic:dashboard-content:v1';
export const REMOTE_SITE_CONTENT_ROW_ID = 'home';
const LEGACY_REMOTE_SITE_CONTENT_ROW_ID = 'main-site';

export const DEFAULT_SITE_CONTENT: SiteContent = {
    headerNav: [
        { id: 'quienes-somos', label: 'Quienes Somos' },
        { id: 'servicios', label: 'Servicios' },
        { id: 'tecnologia', label: 'Tecnologia' },
        { id: 'equipo', label: 'Equipo' },
        { id: 'contacto', label: 'Contacto' },
    ],
    hero: {
        titlePrimary: 'Donde la ciencia y la',
        titleAccent: 'belleza se encuentran.',
        subtitle:
            'Innovacion medica y estetica avanzada en dermatologia, medicina estetica, salud capilar, ginecologia y nutricion clinica, para resultados que elevan tu confianza.',
        ctaLabel: 'Explorar Tratamientos',
        videoUrl: '/Video.MP4',
        slides: SERVICES_DATA.slice(0, 4).map((service) => service.imageUrl),
    },
    philosophy: {
        title: 'Quienes Somos',
        imageUrl: 'https://i.postimg.cc/cd3NzjmC/IMG-7534-JPG.jpg',
        paragraphs: [
            'Be Aesthetic Republica Dominicana es un centro lider en Medicina Estetica, armonizacion facial, Dermatologia, Ginecologia estetica y nutricion clinica, comprometido con la promocion de la salud y el bienestar con un enfoque integral.',
            'Con sucursales en Santo Domingo, Santiago, Puerto Plata y Punta Cana, somos la primera clinica estetica en el pais con presencia en las principales regiones.',
            'Nuestro equipo evalua y trata a cada paciente de forma personalizada, adaptando tratamientos a sus necesidades de cuerpo, rostro y salud.',
        ],
    },
    cta: {
        title: 'Tu transformacion comienza aqui.',
        description:
            'Agenda tu evaluacion y recibe un plan integral en medicina estetica, dermatologia, salud capilar, ginecologia y nutricion clinica, disenado especialmente para ti.',
        buttonLabel: 'Agendar Consulta',
    },
    footer: {
        brandTitle: 'Be',
        brandSubtitle: 'Aesthetic',
        brandDescription: 'Elevando la estetica medica a una forma de arte. Lujo, ciencia y resultados excepcionales.',
        instagramLabel: 'Instagram',
        instagramUrl: 'https://www.instagram.com/beaestheticrd',
    },
    whatsappPhone: '18096392490',
    services: SERVICES_DATA,
    technologies: TECHNOLOGIES_DATA,
    team: TEAM_DATA,
    testimonials: TESTIMONIALS_DATA,
    locations: LOCATIONS_DATA,
};

export const ensureContentShape = (input: Partial<SiteContent> | null | undefined): SiteContent => {
    const safe = input ?? {};
    const mergedTeam = safe.team?.length
        ? [
              ...safe.team,
              ...DEFAULT_SITE_CONTENT.team.filter(
                  (defaultMember) => !safe.team?.some((member) => member.id === defaultMember.id)
              ),
          ]
        : DEFAULT_SITE_CONTENT.team;

    return {
        ...DEFAULT_SITE_CONTENT,
        ...safe,
        hero: {
            ...DEFAULT_SITE_CONTENT.hero,
            ...safe.hero,
            slides: safe.hero?.slides?.length ? safe.hero.slides : DEFAULT_SITE_CONTENT.hero.slides,
        },
        philosophy: {
            ...DEFAULT_SITE_CONTENT.philosophy,
            ...safe.philosophy,
            paragraphs: safe.philosophy?.paragraphs?.length
                ? safe.philosophy.paragraphs
                : DEFAULT_SITE_CONTENT.philosophy.paragraphs,
        },
        cta: {
            ...DEFAULT_SITE_CONTENT.cta,
            ...safe.cta,
        },
        footer: {
            ...DEFAULT_SITE_CONTENT.footer,
            ...safe.footer,
        },
        headerNav: safe.headerNav?.length ? safe.headerNav : DEFAULT_SITE_CONTENT.headerNav,
        services: safe.services?.length ? safe.services : DEFAULT_SITE_CONTENT.services,
        technologies: safe.technologies?.length ? safe.technologies : DEFAULT_SITE_CONTENT.technologies,
        team: mergedTeam,
        testimonials: safe.testimonials?.length ? safe.testimonials : DEFAULT_SITE_CONTENT.testimonials,
        locations: safe.locations?.length ? safe.locations : DEFAULT_SITE_CONTENT.locations,
    };
};

export const loadSiteContent = (): SiteContent => {
    if (typeof window === 'undefined') {
        return DEFAULT_SITE_CONTENT;
    }

    try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_CONTENT_KEY);
        if (!raw) {
            return DEFAULT_SITE_CONTENT;
        }

        const parsed = JSON.parse(raw) as Partial<SiteContent>;
        return ensureContentShape(parsed);
    } catch {
        return DEFAULT_SITE_CONTENT;
    }
};

export const saveSiteContent = (content: SiteContent): void => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(LOCAL_STORAGE_CONTENT_KEY, JSON.stringify(content));
};

export const loadSiteContentFromRemote = async (): Promise<SiteContent | null> => {
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase
        .from('site_content')
        .select('id, content, updated_at')
        .in('id', [REMOTE_SITE_CONTENT_ROW_ID, LEGACY_REMOTE_SITE_CONTENT_ROW_ID])
        .order('updated_at', { ascending: false, nullsFirst: false });

    if (error || !data?.length) {
        return null;
    }

    const preferredRow =
        data.find((row) => row.id === REMOTE_SITE_CONTENT_ROW_ID) ??
        data.find((row) => row.id === LEGACY_REMOTE_SITE_CONTENT_ROW_ID) ??
        data[0];

    if (!preferredRow?.content) {
        return null;
    }

    return ensureContentShape(preferredRow.content as Partial<SiteContent>);
};

export const saveSiteContentToRemote = async (content: SiteContent): Promise<boolean> => {
    if (!supabase) {
        return false;
    }

    const { error } = await supabase.from('site_content').upsert(
        {
            id: REMOTE_SITE_CONTENT_ROW_ID,
            content,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
    );

    return !error;
};

export const resetSiteContent = (): SiteContent => {
    if (typeof window !== 'undefined') {
        window.localStorage.removeItem(LOCAL_STORAGE_CONTENT_KEY);
    }

    return DEFAULT_SITE_CONTENT;
};

export const emptyServiceTemplate = (nextId: number): Service => ({
    id: nextId,
    name: 'Nuevo Servicio',
    category: ServiceCategory.ArmonizacionFacial,
    imageUrl: 'https://via.placeholder.com/640x480?text=Servicio',
    description: 'Describe este servicio aqui.',
});

export const emptyTechnologyTemplate = (nextId: number): Technology => ({
    id: nextId,
    name: 'Nueva Tecnologia',
    imageUrl: 'https://via.placeholder.com/320x320?text=Tecnologia',
});

export const emptyTeamTemplate = (nextId: number): TeamMember => ({
    id: nextId,
    name: 'Nuevo Especialista',
    specialty: 'Especialidad completa',
    shortSpecialty: 'Especialidad',
    imageUrl: 'https://via.placeholder.com/480x640?text=Equipo',
    bio: 'Biografia breve del profesional.',
});

export const emptyTestimonialTemplate = (nextId: number): Testimonial => ({
    id: nextId,
    quote: 'Nuevo testimonio',
    author: 'Paciente',
});

export const emptyLocationTemplate = (nextId: number): Location => ({
    id: `sede-${nextId}`,
    name: 'Nueva Sede',
    address: 'Direccion de la sede',
    phone: '+1 (000) 000-0000',
    mapsLink: 'https://maps.google.com',
});
