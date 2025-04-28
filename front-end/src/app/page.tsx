// import CampaignDetails from "@/components/CampaignDetails"; // Removed for CWI-109
// import { promises as fs } from "fs"; // Removed unused import
// import path from "path"; // Removed unused import

// Keep this function for now if other parts of the page might need it,
// otherwise it can be removed later.
// async function getData() {
//   const campaignDir = path.join(process.cwd(), "public/campaign");
//   const imageFiles = await fs.readdir(campaignDir);
//   const images = imageFiles.map((file) => `/campaign/${file}`);

//   const markdownPath = path.join(process.cwd(), "public/campaign-details.md");
//   const markdownContent = await fs.readFile(markdownPath, "utf8");

//   return { images, markdownContent };
// }

export default async function Home() {
  // const { images, markdownContent } = await getData(); // Removed for CWI-109

  return (
    // Replace with actual BitHedge page content later (e.g., AccountDashboard)
    <main
      className="flex min-h-screen flex-col items-center justify-between p-24"
    >
      BitHedge Home Page Placeholder
      {/* <CampaignDetails images={images} markdownContent={markdownContent} /> */}
    </main>
  );
}
