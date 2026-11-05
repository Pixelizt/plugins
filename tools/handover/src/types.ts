export interface Shot {
  title: string;
  caption: string;
  src: string;
}

export interface WalkthroughProps {
  clientName: string;
  primary: string;
  background: string;
  foreground: string;
  frames: Shot[];
}

export const defaultProps: WalkthroughProps = {
  clientName: "Demo Café",
  primary: "#7A4B2A",
  background: "#FBF7F1",
  foreground: "#1C1917",
  frames: [],
};
