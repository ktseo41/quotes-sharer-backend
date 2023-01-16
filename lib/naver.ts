import axios, { AxiosResponse } from "axios";

type AuthSuccessResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

type AuthFailedResponse = {
  error: string;
  error_description: string;
};

type ProfilelResponse = {
  id: string;
  nickname?: string;
  name?: string;
  email?: string;
  gender?: "F" | "M" | "U";
  age?: string;
  birthday?: string;
  profile_image?: string;
  birthyear?: string;
  mobile?: string;
};

export type NaverProfileResponse = {
  resultcode: string;
  message: string;
  response: ProfilelResponse;
};

export type AuthResponse = AuthSuccessResponse | AuthFailedResponse;

export async function getAuth(
  code: string
): Promise<AxiosResponse<AuthResponse>> {
  return axios.get<AuthResponse>(
    `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${process.env.NAVER_CLIENT_ID}&client_secret=${process.env.NAVER_CLIENT_SECRET}&code=${code}&state=${process.env.NAVER_AUTH_STATE}`
  );
}

type IGetProfile = {
  accessToken: string;
};

export async function getProfile({
  accessToken,
}: IGetProfile): Promise<AxiosResponse<NaverProfileResponse>> {
  return axios.get<NaverProfileResponse>(
    `https://openapi.naver.com/v1/nid/me`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}
