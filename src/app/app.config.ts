import { provideHttpClient, withInterceptors, withNoXsrfProtection, withXhr } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { apiInterceptor, initializeApi } from '../shared/api/api';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withXhr(), withNoXsrfProtection(), withInterceptors([apiInterceptor])),
    initializeApi,
  ],
};
