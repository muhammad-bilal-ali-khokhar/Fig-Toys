import type { Request, Response } from "express";
import {
  getAutoPrint,
  getCompanyProfile,
  getDashboardLayout,
  getSoundPrefs,
  getTheme,
  updateAutoPrint,
  updateCompanyProfile,
  updateDashboardLayout,
  updateSoundPrefs,
  updateTheme,
} from "./service";
import type { AutoPrintInput, CompanyProfileInput, DashboardLayoutInput, SoundPrefsInput, ThemeInput } from "./schemas";

export async function companyGetHandler(req: Request, res: Response) {
  res.json({ data: await getCompanyProfile() });
}

export async function companyPutHandler(req: Request, res: Response) {
  res.json({ data: await updateCompanyProfile(req.body as CompanyProfileInput, req.user!.id) });
}

export async function soundGetHandler(req: Request, res: Response) {
  res.json({ data: await getSoundPrefs(req.user!.id) });
}

export async function soundPutHandler(req: Request, res: Response) {
  res.json({ data: await updateSoundPrefs(req.user!.id, req.body as SoundPrefsInput) });
}

export async function themeGetHandler(req: Request, res: Response) {
  res.json({ data: await getTheme() });
}

export async function themePutHandler(req: Request, res: Response) {
  res.json({ data: await updateTheme((req.body as ThemeInput).theme) });
}

export async function dashboardLayoutGetHandler(req: Request, res: Response) {
  res.json({ data: await getDashboardLayout() });
}

export async function dashboardLayoutPutHandler(req: Request, res: Response) {
  res.json({ data: await updateDashboardLayout((req.body as DashboardLayoutInput).layout) });
}

export async function autoPrintGetHandler(req: Request, res: Response) {
  res.json({ data: await getAutoPrint() });
}

export async function autoPrintPutHandler(req: Request, res: Response) {
  res.json({ data: await updateAutoPrint(req.body as AutoPrintInput) });
}
