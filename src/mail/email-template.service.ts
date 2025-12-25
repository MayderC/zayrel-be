import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export interface TemplateData {
    [key: string]: any;
}

@Injectable()
export class EmailTemplateService {
    private readonly logger = new Logger(EmailTemplateService.name);
    private readonly templatesPath: string;
    private readonly compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

    constructor() {
        // Templates are in src/mail/templates, but code runs from dist/mail
        // We need to go up to project root and then into src/mail/templates
        const possiblePaths = [
            path.join(__dirname, 'templates'),           // dist/mail/templates (if copied)
            path.join(__dirname, '..', 'templates'),     // dist/templates
            path.join(process.cwd(), 'src', 'mail', 'templates'), // src/mail/templates (dev)
        ];

        this.templatesPath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[2];
        this.logger.log(`📁 Templates path: ${this.templatesPath}`);

        this.registerHelpers();
        this.preloadTemplates();
    }

    /**
     * Register custom Handlebars helpers
     */
    private registerHelpers() {
        // Helper for formatting currency
        Handlebars.registerHelper('currency', (value: number) => {
            return new Intl.NumberFormat('es-CR', {
                style: 'currency',
                currency: 'CRC',
            }).format(value);
        });

        // Helper for formatting dates
        Handlebars.registerHelper('date', (value: Date | string) => {
            const date = new Date(value);
            return new Intl.DateTimeFormat('es-CR', {
                dateStyle: 'long',
            }).format(date);
        });

        // Helper for conditional equality
        Handlebars.registerHelper('eq', (a, b) => a === b);
    }

    /**
     * Preload all templates from the templates directory
     */
    private preloadTemplates() {
        try {
            if (!fs.existsSync(this.templatesPath)) {
                this.logger.warn(`Templates directory not found: ${this.templatesPath}`);
                return;
            }

            const files = fs.readdirSync(this.templatesPath);

            for (const file of files) {
                if (file.endsWith('.hbs')) {
                    const templateName = file.replace('.hbs', '');
                    this.loadTemplate(templateName);
                }
            }

            this.logger.log(`📧 Loaded ${this.compiledTemplates.size} email templates`);
        } catch (error) {
            this.logger.error(`Failed to preload templates: ${error.message}`);
        }
    }

    /**
     * Load and compile a single template
     */
    private loadTemplate(templateName: string): HandlebarsTemplateDelegate | null {
        try {
            const templatePath = path.join(this.templatesPath, `${templateName}.hbs`);

            if (!fs.existsSync(templatePath)) {
                this.logger.warn(`Template not found: ${templateName}`);
                return null;
            }

            const templateContent = fs.readFileSync(templatePath, 'utf-8');
            const compiled = Handlebars.compile(templateContent);

            this.compiledTemplates.set(templateName, compiled);
            this.logger.debug(`Loaded template: ${templateName}`);

            return compiled;
        } catch (error) {
            this.logger.error(`Failed to load template ${templateName}: ${error.message}`);
            return null;
        }
    }

    /**
     * Render a template with the given data
     */
    render(templateName: string, data: TemplateData): string {
        let template = this.compiledTemplates.get(templateName);

        // Try to load if not cached
        if (!template) {
            const loaded = this.loadTemplate(templateName);
            if (loaded) {
                template = loaded;
            }
        }

        if (!template) {
            this.logger.warn(`Template "${templateName}" not found, using fallback`);
            return this.renderFallback(templateName, data);
        }

        return template(data);
    }

    /**
     * Fallback rendering when template is not found
     */
    private renderFallback(templateName: string, data: TemplateData): string {
        return `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Zayrel</h2>
                <p>Template: ${templateName}</p>
                <pre>${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * Get list of available templates
     */
    getAvailableTemplates(): string[] {
        return Array.from(this.compiledTemplates.keys());
    }

    /**
     * Reload all templates (useful for development)
     */
    reloadTemplates(): void {
        this.compiledTemplates.clear();
        this.preloadTemplates();
    }
}
