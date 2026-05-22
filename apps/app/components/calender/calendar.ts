import { Calendar } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./calendar.css";

const ShadcnBigCalendar = withDragAndDrop(Calendar);

export default ShadcnBigCalendar;
