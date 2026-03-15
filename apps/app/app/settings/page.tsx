import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserGeneral from "@/components/shadcn-studio/blocks/account-settings-01/account-settings-01";
import { SiteHeader } from "@/components/site-header";

const tabs = [
  { name: "General", value: "general" },
  { name: "Preferences", value: "preferences" },
  { name: "Users", value: "users" },
];

const TabsUnderlineDemo = () => {
  return (
    <>
      <SiteHeader title="Settings" />
      <div className="w-full py-8">
        <div className="mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="general" className="gap-4">
            <TabsList className="h-fit! w-full rounded-none border-b bg-transparent p-0 sm:justify-start">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-none border-0 border-b-2 border-transparent data-[state=active]:shadow-none! sm:flex-0 dark:data-[state=active]:bg-transparent"
                >
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mt-4">
            <UserGeneral />
          </div>
        </div>
      </div>
    </>
  );
};

export default TabsUnderlineDemo;
