export interface Link {
	label: string;
	value: string;
}

export interface Department {
	id: string;
	name: string;
	enName: string;
	logo: string;
	image: string;
	description: string;
	video: string;
	links: Link[];
}

export interface Activity {
	id: string;
	name: string;
	enName: string;
	image: string;
	description: string;
	video: string;
	links: Link[];
}
