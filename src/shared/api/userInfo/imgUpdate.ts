import { AxiosError, type AxiosResponse, isAxiosError } from 'axios';
import { authGuard } from '../../guard/auth';
import { api } from '../api';

type ImageUpdateRequest = {
    
}
export async function imgUpdate(){
    if (!authGuard) {
        throw new Error('Please sign in to update your profile.');
    }

    const response = await api.put('/v1/member/profile/image',null,{
        validateStatus: () => true,
    })

    if (response.status < 200 || response.status >= 300 || response.data?.result === false) {
        throw new Error(response.data?.message || 'Unable to update your profile. Please try again.');
    }

    return response.data;
}