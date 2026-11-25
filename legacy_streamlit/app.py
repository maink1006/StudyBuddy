
import streamlit as st
import sqlite3
import pandas as pd
import time
from datetime import date, datetime
from streamlit_autorefresh import st_autorefresh

# =========================
# 1. CAU HINH APP
# =========================

st.set_page_config(
    page_title="Study Buddy",
    page_icon="📚",
    layout="wide"
)

DB_NAME = "study_buddy.db"


# =========================
# 2. DATABASE
# =========================

def connect_db():
    return sqlite3.connect(DB_NAME)


def create_tables():
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject TEXT,
            due_date TEXT,
            completed INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT,
            minutes INTEGER,
            study_date TEXT
        )
    """)

    conn.commit()
    conn.close()


def get_tasks():
    conn = connect_db()
    df = pd.read_sql_query(
        "SELECT * FROM tasks ORDER BY id DESC",
        conn
    )
    conn.close()
    return df


def add_task(title, subject, due_date):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO tasks (title, subject, due_date)
        VALUES (?, ?, ?)
        """,
        (title, subject, str(due_date))
    )

    conn.commit()
    conn.close()


def complete_task(task_id):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE tasks SET completed = 1 WHERE id = ?",
        (task_id,)
    )

    conn.commit()
    conn.close()


def delete_task(task_id):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM tasks WHERE id = ?",
        (task_id,)
    )

    conn.commit()
    conn.close()


def save_study_session(subject, minutes):
    conn = connect_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO study_sessions (subject, minutes, study_date)
        VALUES (?, ?, ?)
        """,
        (subject, minutes, str(date.today()))
    )

    conn.commit()
    conn.close()


def get_study_sessions():
    conn = connect_db()

    df = pd.read_sql_query(
        "SELECT * FROM study_sessions",
        conn
    )

    conn.close()
    return df


# Tao database neu chua co
create_tables()


# =========================
# 3. GIAO DIEN
# =========================

st.title("📚 Study Buddy")
st.caption("Your little companion for better study days.")

st.markdown("""
<style>
.stApp {
    background-color: #FFF8F0;
}

h1, h2, h3 {
    color: #735D78;
}

div.stButton > button {
    border-radius: 12px;
    border: 1px solid #E8B4B8;
}

</style>
""", unsafe_allow_html=True)


# =========================
# 4. SIDEBAR
# =========================

st.sidebar.title("Study Buddy 🐰")

page = st.sidebar.radio(
    "Menu",
    [
        "Dashboard",
        "My Tasks",
        "Pomodoro",
        "Study Statistics"
    ]
)


# =========================
# 5. DASHBOARD
# =========================

if page == "Dashboard":

    st.header("Welcome back! 🌷")

    tasks = get_tasks()
    sessions = get_study_sessions()

    today = str(date.today())

    today_minutes = 0

    if not sessions.empty:
        today_minutes = sessions[
            sessions["study_date"] == today
        ]["minutes"].sum()

    completed_tasks = 0
    total_tasks = len(tasks)

    if not tasks.empty:
        completed_tasks = int(
            tasks["completed"].sum()
        )

    col1, col2, col3 = st.columns(3)

    col1.metric(
        "Study time today",
        f"{int(today_minutes)} min"
    )

    col2.metric(
        "Tasks completed",
        f"{completed_tasks}/{total_tasks}"
    )

    col3.metric(
        "Daily study goal",
        "120 min"
    )

    st.divider()

    st.subheader("Today's tasks")

    if tasks.empty:
        st.info("You have no tasks yet. Add one in My Tasks!")

    else:
        today_tasks = tasks[
            tasks["due_date"] == today
        ]

        if today_tasks.empty:
            st.write("No tasks scheduled for today.")

        else:
            for _, task in today_tasks.iterrows():

                if task["completed"]:
                    st.write(
                        f"✅ ~~{task['title']}~~"
                    )
                else:
                    st.write(
                        f"📝 {task['title']}"
                    )


# =========================
# 6. TASK MANAGER
# =========================

elif page == "My Tasks":

    st.header("My Tasks 📝")

    with st.form("task_form"):

        title = st.text_input(
            "Task name",
            placeholder="Example: Review Python functions"
        )

        subject = st.text_input(
            "Subject",
            placeholder="Example: Python"
        )

        due_date = st.date_input(
            "Due date",
            value=date.today()
        )

        submitted = st.form_submit_button(
            "Add task"
        )

        if submitted:

            if title.strip():

                add_task(
                    title.strip(),
                    subject.strip(),
                    due_date
                )

                st.success("Task added!")
                st.rerun()

            else:
                st.warning("Please enter a task name.")

    st.divider()

    tasks = get_tasks()

    if tasks.empty:
        st.info("Your task list is empty.")

    else:

        for _, task in tasks.iterrows():

            col1, col2, col3 = st.columns(
                [5, 1, 1]
            )

            with col1:

                if task["completed"]:
                    st.write(
                        f"✅ {task['title']}"
                    )
                else:
                    st.write(
                        f"📌 {task['title']}"
                    )

                st.caption(
                    f"{task['subject']} · Due: {task['due_date']}"
                )

            with col2:

                if not task["completed"]:

                    if st.button(
                        "Done",
                        key=f"done_{task['id']}"
                    ):

                        complete_task(
                            int(task["id"])
                        )

                        st.rerun()

            with col3:

                if st.button(
                    "Delete",
                    key=f"delete_{task['id']}"
                ):

                    delete_task(
                        int(task["id"])
                    )

                    st.rerun()


# =========================
# 7. POMODORO TIMER
# =========================

elif page == "Pomodoro":

    st.header("Pomodoro Timer 🍅")

    subject = st.text_input(
        "What are you studying?",
        value="General study"
    )

    study_minutes = st.selectbox(
        "Study duration",
        [15, 25, 30, 45, 60],
        index=1
    )

    if "timer_running" not in st.session_state:
        st.session_state.timer_running = False

    if "timer_end" not in st.session_state:
        st.session_state.timer_end = None

    if "timer_saved" not in st.session_state:
        st.session_state.timer_saved = False

    if "timer_duration" not in st.session_state:
        st.session_state.timer_duration = study_minutes

    if not st.session_state.timer_running:

        if st.button("▶ Start studying"):

            st.session_state.timer_duration = study_minutes

            st.session_state.timer_end = (
                time.time() + study_minutes * 60
            )

            st.session_state.timer_running = True
            st.session_state.timer_saved = False

            st.rerun()

    if st.session_state.timer_running:

        st_autorefresh(
            interval=1000,
            key="timer_refresh"
        )

        remaining = max(
            0,
            int(
                st.session_state.timer_end - time.time()
            )
        )

        minutes = remaining // 60
        seconds = remaining % 60

        st.markdown(
            f"<h1 style='text-align:center;"
            f"font-size:70px;color:#735D78;'>"
            f"{minutes:02d}:{seconds:02d}"
            f"</h1>",
            unsafe_allow_html=True
        )

        if remaining > 0:

            if st.button("⏸ Stop session"):

                st.session_state.timer_running = False
                st.session_state.timer_end = None

                st.rerun()

        else:

            st.session_state.timer_running = False

            if not st.session_state.timer_saved:

                save_study_session(
                    subject,
                    st.session_state.timer_duration
                )

                st.session_state.timer_saved = True

            st.success("Great job! Study session completed 🎉")


# =========================
# 8. STUDY STATISTICS
# =========================

elif page == "Study Statistics":

    st.header("Study Statistics 📊")

    sessions = get_study_sessions()

    if sessions.empty:

        st.info(
            "Complete a Pomodoro session to see your statistics."
        )

    else:

        sessions["study_date"] = pd.to_datetime(
            sessions["study_date"]
        )

        daily = sessions.groupby(
            "study_date"
        )["minutes"].sum()

        st.metric(
            "Total study time",
            f"{int(sessions['minutes'].sum())} minutes"
        )

        st.subheader("Study time by day")

        st.bar_chart(daily)

        st.subheader("Study time by subject")

        subject_data = sessions.groupby(
            "subject"
        )["minutes"].sum()

        st.bar_chart(subject_data)
